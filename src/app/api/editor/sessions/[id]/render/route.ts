import { NextResponse } from "next/server";

import {
  type EditOps,
  SUPPORTED_OUTPUTS,
  readSession,
  writeSession,
} from "@/lib/editor/session";
import { renderSession } from "@/lib/editor/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Incoming = Partial<EditOps>;

function clamp01(n: unknown, fallback = 0): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

function sanitizeOps(input: Incoming, sourceDuration: number): EditOps {
  const trimIn = Math.max(0, Math.min(sourceDuration, Number(input.trimIn) || 0));
  const trimOut = Math.max(
    trimIn + 0.1,
    Math.min(sourceDuration, Number(input.trimOut) || sourceDuration)
  );
  const speed = Math.max(0.25, Math.min(4, Number(input.speed) || 1));
  const captions: EditOps["captions"] = Array.isArray(input.captions)
    ? input.captions.slice(0, 8).map((c) => {
        const bg: EditOps["captions"][number]["background"] =
          c?.background === "black" ||
          c?.background === "white" ||
          c?.background === "yellow"
            ? c.background
            : "none";
        return {
          text: String(c?.text || "").slice(0, 200),
          x: clamp01(c?.x, 0.05),
          y: clamp01(c?.y, 0.05),
          fontSize: Math.max(12, Math.min(160, Number(c?.fontSize) || 36)),
          color: String(c?.color || "#fbbf24").slice(0, 16),
          background: bg,
        };
      })
    : [];
  const blurs = Array.isArray(input.blurs)
    ? input.blurs.slice(0, 4).map((b) => ({
        x: clamp01(b?.x, 0.1),
        y: clamp01(b?.y, 0.1),
        w: clamp01(b?.w, 0.2),
        h: clamp01(b?.h, 0.2),
        // Client-side ceiling; ffmpeg may further clamp per-region below.
        intensity: Math.max(1, Math.min(100, Number(b?.intensity) || 18)),
      }))
    : [];
  const cropRaw = input.crop;
  const crop = cropRaw
    ? {
        x: clamp01(cropRaw.x, 0),
        y: clamp01(cropRaw.y, 0),
        w: Math.max(0.05, clamp01(cropRaw.w, 1)),
        h: Math.max(0.05, clamp01(cropRaw.h, 1)),
      }
    : null;
  const fmt = (SUPPORTED_OUTPUTS as readonly string[]).includes(
    String(input.format)
  )
    ? (input.format as EditOps["format"])
    : "mp4";
  const fps =
    fmt === "gif" || fmt === "webp"
      ? Math.max(8, Math.min(30, Number(input.fps) || 15))
      : undefined;
  const width =
    input.width && Number(input.width) > 0
      ? Math.max(120, Math.min(1920, Math.round(Number(input.width))))
      : undefined;
  const quality: EditOps["quality"] =
    input.quality === "low" || input.quality === "high" ? input.quality : "medium";
  const colorIn = input.color;
  const color: EditOps["color"] | undefined = colorIn
    ? {
        brightness: Math.max(-1, Math.min(1, Number(colorIn.brightness) || 0)),
        contrast: Math.max(0, Math.min(2, Number(colorIn.contrast) || 1)),
        saturation: Math.max(0, Math.min(3, Number(colorIn.saturation) || 1)),
      }
    : undefined;
  const wmIn = input.watermark;
  const watermark: EditOps["watermark"] | undefined =
    wmIn && typeof wmIn.text === "string" && wmIn.text.trim().length > 0
      ? {
          text: String(wmIn.text).slice(0, 80),
          position:
            wmIn.position === "tl" ||
            wmIn.position === "tr" ||
            wmIn.position === "bl" ||
            wmIn.position === "br"
              ? wmIn.position
              : "br",
          opacity: Math.max(0, Math.min(1, Number(wmIn.opacity) || 0.8)),
          fontSize: Math.max(10, Math.min(80, Number(wmIn.fontSize) || 20)),
        }
      : undefined;
  const stickersIn = Array.isArray(input.stickers) ? input.stickers : [];
  const stickers: EditOps["stickers"] = stickersIn.slice(0, 4).map((st) => ({
    file: String(st?.file || "").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80),
    x: clamp01(st?.x, 0),
    y: clamp01(st?.y, 0),
    scale: Math.max(0.05, Math.min(1, Number(st?.scale) || 0.2)),
  }));
  return {
    trimIn,
    trimOut,
    speed,
    captions,
    blurs,
    crop,
    format: fmt,
    fps,
    width,
    quality,
    color,
    watermark,
    stickers,
  };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const s = await readSession(id);
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (s.status === "rendering")
    return NextResponse.json({ error: "Already rendering" }, { status: 409 });

  let body: Incoming;
  try {
    body = (await req.json()) as Incoming;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ops = sanitizeOps(body, s.source.duration);

  // Mark as rendering immediately, then run ffmpeg async (do not block response)
  s.status = "rendering";
  s.ops = ops;
  s.error = null;
  s.output = null;
  await writeSession(s);

  // Fire and forget
  void renderSession(s, ops).catch((e) => {
    console.error("editor:render_failed", id, e);
  });

  return NextResponse.json({ ok: true, status: s.status }, { status: 202 });
}
