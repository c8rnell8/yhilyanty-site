import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

export const SESSIONS_DIR =
  process.env.EDITOR_SESSIONS_DIR ||
  "/home/ubuntu/yhilyanty-site/.editor-sessions";

export const MAX_SOURCE_BYTES = 100 * 1024 * 1024; // 100 MB
export const SUPPORTED_INPUTS = new Set([
  ".mp4",
  ".mov",
  ".webm",
  ".mkv",
  ".gif",
  ".m4v",
]);

export const SUPPORTED_OUTPUTS = ["mp4", "gif", "webp"] as const;
export type OutputFormat = (typeof SUPPORTED_OUTPUTS)[number];

export type CaptionOp = {
  text: string;
  // 0..1 in the video frame
  x: number;
  y: number;
  fontSize: number; // px (in source res reference)
  color: string; // #rrggbb
  background: "none" | "black" | "white" | "yellow";
};

export type BlurOp = {
  x: number; // 0..1
  y: number; // 0..1
  w: number; // 0..1
  h: number; // 0..1
  intensity: number; // 5..30
};

export type CropOp = {
  x: number; // 0..1
  y: number; // 0..1
  w: number; // 0..1
  h: number; // 0..1
};

export type EditOps = {
  trimIn: number; // seconds
  trimOut: number; // seconds (relative to source)
  speed: number; // 0.25 .. 4.0
  captions: CaptionOp[];
  blurs: BlurOp[];
  crop: CropOp | null;
  format: OutputFormat;
  fps?: number; // GIF only
  width?: number; // optional resize
};

export type SessionStatus =
  | "uploaded"
  | "editing"
  | "rendering"
  | "rendered"
  | "failed";

export type EditorSession = {
  id: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  origin: {
    discordUserId: string | null;
    discordUsername: string | null;
    discordChannelId: string | null;
    discordGuildId: string | null;
    discordMessageId: string | null;
  };
  source: {
    filename: string;
    ext: string;
    bytes: number;
    duration: number; // seconds
    width: number;
    height: number;
    fps: number;
  };
  ops: EditOps | null;
  output: {
    ext: string;
    bytes: number;
    duration: number;
  } | null;
  error: string | null;
};

export function newSessionId(): string {
  return crypto.randomBytes(9).toString("hex");
}

export function sessionDir(id: string): string {
  return path.join(SESSIONS_DIR, id);
}

export async function ensureRoot(): Promise<void> {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
}

export async function readSession(id: string): Promise<EditorSession | null> {
  try {
    const raw = await fs.readFile(
      path.join(sessionDir(id), "session.json"),
      "utf8"
    );
    return JSON.parse(raw) as EditorSession;
  } catch {
    return null;
  }
}

export async function writeSession(s: EditorSession): Promise<void> {
  s.updatedAt = new Date().toISOString();
  await fs.mkdir(sessionDir(s.id), { recursive: true });
  await fs.writeFile(
    path.join(sessionDir(s.id), "session.json"),
    JSON.stringify(s, null, 2),
    "utf8"
  );
}

export async function probeMedia(
  filePath: string
): Promise<{ duration: number; width: number; height: number; fps: number }> {
  return new Promise((resolve, reject) => {
    const args = [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,r_frame_rate:format=duration",
      "-of",
      "json",
      filePath,
    ];
    const p = spawn("ffprobe", args);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe failed: ${err}`));
      try {
        const j = JSON.parse(out);
        const stream = j.streams?.[0] || {};
        const fmt = j.format || {};
        const fpsStr = String(stream.r_frame_rate || "0/1");
        const [num, den] = fpsStr.split("/").map(Number);
        const fps = den ? num / den : 0;
        resolve({
          duration: Number(fmt.duration) || 0,
          width: Number(stream.width) || 0,
          height: Number(stream.height) || 0,
          fps,
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  });
}

/** Constant-time comparison of provided token vs env. Returns true if both
 *  match. If env token is unset, returns true (open mode for local testing). */
export function checkBotToken(req: Request): boolean {
  const expected = process.env.YHILBOT_API_TOKEN;
  if (!expected) return true;
  const got = req.headers.get("x-yhilbot-token") || "";
  if (got.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}
