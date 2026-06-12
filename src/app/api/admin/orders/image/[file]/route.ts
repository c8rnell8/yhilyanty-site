import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { requireRole } from "@/lib/cms/guard";
import { ORDER_UPLOADS_DIR } from "@/lib/cms/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** Customer-uploaded order photos. Staff only — these never go public. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const guard = await requireRole("admin");
  if (guard) return guard;

  const { file } = await ctx.params;
  if (!/^ord_[A-Za-z0-9_]+\.\d\.(png|jpg|webp|gif)$/.test(file))
    return NextResponse.json({ error: "Bad filename" }, { status: 400 });

  const target = path.join(ORDER_UPLOADS_DIR, file);
  const stat = await fs.stat(target).catch(() => null);
  if (!stat || !stat.isFile())
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mime = MIME[path.extname(file)];
  const stream = createReadStream(target);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=300",
    },
  });
}
