import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { readSession, sessionDir } from "@/lib/editor/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".gif": "image/gif",
  ".webp": "image/webp",
  // Input source may still be webm — keep MIME mapping for source streaming.
  ".webm": "video/webm",
};

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const s = await readSession(id);
  if (!s || !s.output)
    return NextResponse.json(
      { error: "Output not ready" },
      { status: 404 }
    );

  const filePath = path.join(sessionDir(id), `output${s.output.ext}`);
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat)
    return NextResponse.json({ error: "Output missing" }, { status: 404 });
  const total = stat.size;
  const url = new URL(req.url);
  const dl = url.searchParams.get("dl") === "1";
  const mime = MIME[s.output.ext] || "application/octet-stream";
  const filename = `yhilbot-${id}${s.output.ext}`;

  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Length": String(total),
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Content-Disposition": dl
        ? `attachment; filename="${filename}"`
        : `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
