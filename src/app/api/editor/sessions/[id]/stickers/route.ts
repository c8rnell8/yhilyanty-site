import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { readSession, sessionDir } from "@/lib/editor/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_STICKER_BYTES = 3 * 1024 * 1024; // 3 MB
const ALLOWED_EXT = new Set([".png", ".webp"]);

/** POST /api/editor/sessions/[id]/stickers
 *  multipart/form-data { file: File }  →  { ok: true, file: "sticker_N.png" }
 *
 *  Small images (PNG/WebP only, up to 3 MB) uploaded alongside the session
 *  source for use in the sticker overlay editor. File name is assigned by the
 *  server and returned — the client uses it in `ops.stickers[i].file`. The
 *  render pipeline uses only that assigned name (never client-controlled
 *  paths), so there's no filesystem escape risk. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const s = await readSession(id);
  if (!s)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  const ext = ("." + (file.name.split(".").pop() || "").toLowerCase()) || "";
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: `Unsupported sticker format ${ext}; use PNG or WebP` },
      { status: 400 }
    );
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_STICKER_BYTES) {
    return NextResponse.json(
      { error: `Sticker too large (max 3 MB)` },
      { status: 400 }
    );
  }

  const dir = sessionDir(id);
  await fs.mkdir(dir, { recursive: true });

  // Assign the lowest unused index so multiple uploads don't collide.
  let idx = 0;
  while (idx < 32) {
    const candidate = path.join(dir, `sticker_${idx}${ext}`);
    try {
      await fs.access(candidate);
      idx += 1;
    } catch {
      break;
    }
  }
  const name = `sticker_${idx}${ext}`;
  await fs.writeFile(path.join(dir, name), buf);

  return NextResponse.json({ ok: true, file: name });
}

/** GET /api/editor/sessions/[id]/stickers?file=sticker_0.png
 *  Serves a stored sticker back to the client for preview. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const fileParam = (url.searchParams.get("file") || "").replace(
    /[^a-zA-Z0-9._-]/g,
    ""
  );
  if (!fileParam || !fileParam.startsWith("sticker_")) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }
  const filePath = path.join(sessionDir(id), fileParam);
  try {
    await fs.access(filePath);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const mime = fileParam.endsWith(".webp") ? "image/webp" : "image/png";
  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
