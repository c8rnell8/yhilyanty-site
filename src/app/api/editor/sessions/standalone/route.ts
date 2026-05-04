import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

import { getSession } from "@/lib/auth";
import {
  type EditorSession,
  MAX_SOURCE_BYTES,
  SUPPORTED_INPUTS,
  ensureRoot,
  newSessionId,
  probeMedia,
  sessionDir,
  writeSession,
} from "@/lib/editor/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/editor/sessions/standalone
 *  multipart/form-data: file=<video>
 *
 *  Creates an editor session for a logged-in site user that has no Discord
 *  origin — so the bot will NOT echo the render back to any channel. Output
 *  is downloaded directly from /api/editor/sessions/[id]/output.
 *
 *  Auth: requires a valid site session cookie (Discord OAuth login). Keeps
 *  the endpoint from being used as a public upload storage pool. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureRoot();

  const ct = req.headers.get("content-type") || "";
  if (!ct.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_SOURCE_BYTES} bytes)` },
      { status: 413 }
    );
  }
  const origName = file.name || "input.bin";
  const ext = path.extname(origName).toLowerCase() || ".mp4";
  if (!SUPPORTED_INPUTS.has(ext)) {
    return NextResponse.json(
      { error: `Unsupported input extension ${ext}` },
      { status: 400 }
    );
  }

  const id = newSessionId();
  const dir = sessionDir(id);
  await fs.mkdir(dir, { recursive: true });
  const sourcePath = path.join(dir, `source${ext}`);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(sourcePath, buf);

  let probe: { duration: number; width: number; height: number; fps: number };
  try {
    probe = await probeMedia(sourcePath);
  } catch (e) {
    await fs.rm(dir, { recursive: true, force: true });
    return NextResponse.json(
      { error: `ffprobe failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  // Standalone session: origin.discordUsername kept as the user's display name
  // so the editor UI can still greet them, but discordChannelId is null so
  // the bot's polling loop will skip delivery.
  const editorSession: EditorSession = {
    id,
    status: "uploaded",
    createdAt: now,
    updatedAt: now,
    origin: {
      discordUserId: session.id,
      discordUsername: session.username,
      discordChannelId: null,
      discordGuildId: null,
      discordMessageId: null,
    },
    source: {
      filename: origName.slice(0, 255),
      ext,
      bytes: file.size,
      duration: probe.duration,
      width: probe.width,
      height: probe.height,
      fps: probe.fps,
    },
    ops: null,
    output: null,
    error: null,
  };

  await writeSession(editorSession);

  const locale = String(form.get("locale") || "ua");
  return NextResponse.json(
    {
      id: editorSession.id,
      status: editorSession.status,
      editorUrl: `/${locale}/editor/${id}`,
    },
    { status: 201 }
  );
}
