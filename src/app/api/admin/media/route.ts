import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

import { auditLog } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { requireRole } from "@/lib/cms/guard";
import { MEDIA_DIR } from "@/lib/cms/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".mp4",
  ".webm",
]);

function safeName(original: string): string {
  const ext = path.extname(original).toLowerCase();
  const base = path
    .basename(original, path.extname(original))
    .replace(/[^a-zA-Z0-9а-яА-ЯіїєґІЇЄҐ_-]+/g, "_")
    .slice(0, 60);
  const stamp = Date.now().toString(36);
  return `${base || "file"}.${stamp}${ext}`;
}

/** GET — list of everything in the library, newest first. */
export async function GET() {
  const guard = await requireRole("editor");
  if (guard) return guard;

  await fs.mkdir(MEDIA_DIR, { recursive: true });
  const names = await fs.readdir(MEDIA_DIR);
  const files = [];
  for (const name of names) {
    const stat = await fs.stat(path.join(MEDIA_DIR, name)).catch(() => null);
    if (!stat?.isFile()) continue;
    files.push({
      name,
      bytes: stat.size,
      mtime: stat.mtimeMs,
      url: `/api/cms/media/${encodeURIComponent(name)}`,
      kind: [".mp4", ".webm"].includes(path.extname(name).toLowerCase())
        ? "video"
        : "image",
    });
  }
  files.sort((a, b) => b.mtime - a.mtime);
  return NextResponse.json({ files });
}

/** POST multipart { file } — add one file to the library. */
export async function POST(req: Request) {
  const guard = await requireRole("editor", req);
  if (guard) return guard;

  const ct = req.headers.get("content-type") || "";
  if (!ct.toLowerCase().includes("multipart/form-data"))
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json(
      { error: `Файл завеликий (макс ${MAX_BYTES / 1024 / 1024} МБ)` },
      { status: 413 },
    );
  const ext = path.extname(file.name || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext))
    return NextResponse.json(
      { error: `Підтримуються: ${[...ALLOWED_EXT].join(", ")}` },
      { status: 400 },
    );

  await fs.mkdir(MEDIA_DIR, { recursive: true });
  const name = safeName(file.name || `file${ext}`);
  await fs.writeFile(path.join(MEDIA_DIR, name), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({
    ok: true,
    name,
    url: `/api/cms/media/${encodeURIComponent(name)}`,
  });
}

/** DELETE ?file= — remove a library file. */
export async function DELETE(req: Request) {
  const guard = await requireRole("editor", req);
  if (guard) return guard;

  const file = new URL(req.url).searchParams.get("file") || "";
  if (!/^[^/\\]+$/.test(file) || file.includes(".."))
    return NextResponse.json({ error: "Bad filename" }, { status: 400 });

  await fs.unlink(path.join(MEDIA_DIR, file)).catch(() => {});
  const session = await getSession();
  await auditLog(session, "media.delete", file);
  return NextResponse.json({ ok: true });
}
