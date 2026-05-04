import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

export const SESSIONS_DIR =
  process.env.EDITOR_SESSIONS_DIR ||
  path.join(process.cwd(), ".editor-sessions");

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
  intensity: number; // 1..100 (ffmpeg further clamps to (min(w,h)-1)/2 per region)
};

export type CropOp = {
  x: number; // 0..1
  y: number; // 0..1
  w: number; // 0..1
  h: number; // 0..1
};

export type QualityPreset = "low" | "medium" | "high";

/** Color adjustment via ffmpeg `eq` filter. Neutral = { brightness: 0,
 *  contrast: 1, saturation: 1 } (these are the ffmpeg defaults). */
export type ColorOp = {
  brightness: number; // -1 .. 1 (0 = neutral)
  contrast: number; // 0 .. 2 (1 = neutral)
  saturation: number; // 0 .. 3 (1 = neutral)
};

/** Watermark: text anchored to a corner with configurable opacity.
 *  Keeps branding light; for heavier branding use sticker overlays. */
export type WatermarkOp = {
  text: string; // up to 80 chars
  position: "tl" | "tr" | "bl" | "br";
  opacity: number; // 0..1
  fontSize?: number; // px in source reference, default 20
};

/** Sticker overlay: a PNG uploaded to the session dir, positioned normalized
 *  within the output frame, with optional scale. The server stores it as
 *  sticker_<idx>.png alongside the source. */
export type StickerOp = {
  /** File name inside the session dir (e.g. "sticker_0.png"). */
  file: string;
  x: number; // 0..1 (left edge of sticker, normalized to output width)
  y: number; // 0..1 (top edge of sticker, normalized to output height)
  /** Scale as fraction of output width. 0.2 means 20% of output width. */
  scale: number; // 0.05 .. 1.0
};

export type EditOps = {
  trimIn: number; // seconds
  trimOut: number; // seconds (relative to source)
  speed: number; // 0.25 .. 4.0
  captions: CaptionOp[];
  blurs: BlurOp[];
  crop: CropOp | null;
  format: OutputFormat;
  fps?: number; // GIF and animated WebP (both honour the fps filter)
  width?: number; // optional resize
  /** Overall output quality preset. Maps to CRF for MP4, -q:v for WebP.
   *  Missing/unknown values => "medium". */
  quality?: QualityPreset;
  /** Color adjustment; missing means neutral (no eq filter). */
  color?: ColorOp;
  /** Corner watermark; missing or empty text means no watermark. */
  watermark?: WatermarkOp;
  /** Sticker overlays (max 4 to keep ffmpeg cmdline manageable). */
  stickers?: StickerOp[];
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
  /** Monotonic counter that ticks on every successful render completion.
   *  Consumers (e.g. the Discord bot's delivery task) use this to distinguish
   *  a newly-finished render from a previously-delivered one, so the same
   *  session can produce multiple renders and each gets its own delivery. */
  renderGen?: number;
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
