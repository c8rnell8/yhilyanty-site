import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { IMAGES_DIR } from "@/lib/cms/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ file: string }> }
) {
  const { file } = await ctx.params;
  // Disallow path traversal — only allow plain filenames with a known
  // image extension ("." and ".." would pass a bare charset check).
  if (!/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(file) || file.includes(".."))
    return NextResponse.json({ error: "Bad filename" }, { status: 400 });
  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext];
  if (!mime)
    return NextResponse.json({ error: "Bad filename" }, { status: 400 });

  const target = path.join(IMAGES_DIR, file);
  const stat = await fs.stat(target).catch(() => null);
  if (!stat || !stat.isFile())
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const stream = createReadStream(target);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=300, must-revalidate",
    },
  });
}
