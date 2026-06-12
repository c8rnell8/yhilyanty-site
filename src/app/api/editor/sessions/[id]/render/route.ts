import { NextResponse } from "next/server";

import {
  type EditOps,
  SUPPORTED_OUTPUTS,
  readSession,
  writeSession,
} from "@/lib/editor/session";
import { renderSession } from "@/lib/editor/render";
import { rateLimit } from "@/lib/rate-limit";

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
        intensity: Math.max(2, Math.min(40, Number(b?.intensity) || 18)),
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

  const num = (v: unknown, lo: number, hi: number, dflt: number): number => {
    const n = Number(v);
    if (!Number.isFinite(n)) return dflt;
    return Math.max(lo, Math.min(hi, n));
  };
  const rotate = ([90, 180, 270] as const).find((r) => r === Number(input.rotate)) || 0;
  const targetSizeMB =
    (fmt === "mp4" || fmt === "webm") && Number(input.targetSizeMB) > 0
      ? num(input.targetSizeMB, 1, 100, 20)
      : undefined;

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
    mute: input.mute === true,
    volume: num(input.volume, 0, 3, 1),
    brightness: num(input.brightness, -0.5, 0.5, 0),
    contrast: num(input.contrast, 0.5, 2, 1),
    saturation: num(input.saturation, 0, 3, 1),
    rotate,
    fadeIn: num(input.fadeIn, 0, 5, 0),
    fadeOut: num(input.fadeOut, 0, 5, 0),
    targetSizeMB,
  };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  // ffmpeg is the most expensive thing this server runs - cap how often a
  // single client can kick it off.
  const limited = rateLimit(req, "render", 10, 600);
  if (limited) return limited;

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
