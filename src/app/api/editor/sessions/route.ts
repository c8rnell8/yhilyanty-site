import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  type EditorSession,
  MAX_SOURCE_BYTES,
  SUPPORTED_INPUTS,
  checkBotToken,
  ensureRoot,
  newSessionId,
  probeMedia,
  sessionDir,
  writeSession,
} from "@/lib/editor/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/editor/sessions
 *  multipart/form-data: file=<video> (+ optional text fields)
 *  Authenticates via X-Yhilbot-Token if YHILBOT_API_TOKEN env is set.
 */
export async function POST(req: Request) {
  if (!checkBotToken(req)) {
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
    return NextResponse.json(
      { error: "Missing 'file' field" },
      { status: 400 }
    );
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

  let probe: {
    duration: number;
    width: number;
    height: number;
    fps: number;
    hasAudio: boolean;
  };
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
  const session: EditorSession = {
    id,
    status: "uploaded",
    createdAt: now,
    updatedAt: now,
    origin: {
      discordUserId: String(form.get("discord_user_id") || "") || null,
      discordUsername: String(form.get("discord_username") || "") || null,
      discordChannelId: String(form.get("discord_channel_id") || "") || null,
      discordGuildId: String(form.get("discord_guild_id") || "") || null,
      discordMessageId: String(form.get("discord_message_id") || "") || null,
    },
    source: {
      filename: origName.slice(0, 255),
      ext,
      bytes: file.size,
      duration: probe.duration,
      width: probe.width,
      height: probe.height,
      fps: probe.fps,
      hasAudio: probe.hasAudio,
    },
    ops: null,
    output: null,
    error: null,
  };

  await writeSession(session);

  const baseUrl =
    process.env.SITE_URL || `${new URL(req.url).origin}`;
  const locale = String(form.get("locale") || "ua");
  return NextResponse.json(
    {
      id: session.id,
      status: session.status,
      editorUrl: `${baseUrl}/${locale}/editor/${id}`,
      statusUrl: `${baseUrl}/api/editor/sessions/${id}`,
      source: session.source,
    },
    { status: 201 }
  );
}
