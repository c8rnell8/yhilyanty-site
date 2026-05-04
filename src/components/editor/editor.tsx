"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  ScissorsIcon,
  TextAaIcon,
  EyeSlashIcon,
  CropIcon,
  SpeedometerIcon,
  ExportIcon,
  PlayIcon,
  PauseIcon,
  PlusIcon,
  TrashIcon,
  DownloadIcon,
  LinkIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  ArrowsHorizontalIcon,
  PaletteIcon,
  StickerIcon,
  CopyrightIcon,
} from "@phosphor-icons/react";

import { Link } from "@/i18n/navigation";

type Strings = Record<string, string>;

type Caption = {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  background: "none" | "black" | "white" | "yellow";
};

type Blur = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  intensity: number;
};

type Crop = { x: number; y: number; w: number; h: number };

type Tool =
  | "trim"
  | "text"
  | "blur"
  | "crop"
  | "speed"
  | "color"
  | "watermark"
  | "stickers"
  | "output";

type Quality = "low" | "medium" | "high";

type Sticker = {
  id: string;
  file: string; // server-assigned filename
  url: string; // GET url for preview
  x: number; // 0..1
  y: number; // 0..1
  scale: number; // 0.05..1
};

type Watermark = {
  text: string;
  position: "tl" | "tr" | "bl" | "br";
  opacity: number;
  fontSize: number;
};

type Status =
  | "uploaded"
  | "editing"
  | "rendering"
  | "rendered"
  | "failed";

const STATUS_LABEL: Record<Status, keyof Strings> = {
  uploaded: "statusUploaded",
  editing: "statusEditing",
  rendering: "statusRendering",
  rendered: "statusRendered",
  failed: "statusFailed",
};

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function fmtTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m.toString().padStart(2, "0")}:${r.toFixed(2).padStart(5, "0")}`;
}

const DISCORD_LIMIT_MB = 25;
const DISCORD_LIMIT_BYTES = DISCORD_LIMIT_MB * 1024 * 1024;

/**
 * Rough size estimator. GIF and animated WebP blow up *fast* on high-motion
 * content; MP4/H.264 is much more efficient. These coefficients are deliberately
 * pessimistic so the "within 25MB" bar actually protects the user.
 *
 * Real-world calibration (rough, for a "typical" handheld clip at 720p/15fps):
 *   - GIF:  8–14 bits/px/frame (palette + high entropy)  →  ~1.4 bits/px/frame
 *     averaged across duration when accounting for lzw compression on steady shots.
 *     We use 2.2 to be pessimistic on the bar.
 *   - WebP: 0.25–0.45 bits/px/frame at libwebp default quality ~75 lossy.
 *   - MP4:  0.10–0.20 bits/px/frame at CRF 23 for most clips.
 */
function estimateOutputBytes(opts: {
  format: "mp4" | "gif" | "webp";
  durationSec: number;
  width: number;
  height: number;
  fps: number;
}): number {
  const dur = Math.max(0.1, opts.durationSec);
  const px = Math.max(1, opts.width * opts.height);
  if (opts.format === "gif") {
    return Math.round((px * opts.fps * dur * 2.2) / 8);
  }
  if (opts.format === "webp") {
    return Math.round((px * opts.fps * dur * 0.35) / 8);
  }
  // mp4/h264 renders at source fps in render.ts; assume 30 for estimation.
  return Math.round((px * 30 * dur * 0.18) / 8);
}

/** Estimate for all three output formats so the user can see which ones fit
 *  in Discord's 25MB limit at a glance. */
function estimateAllFormats(opts: {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
}): { mp4: number; gif: number; webp: number } {
  return {
    mp4: estimateOutputBytes({ ...opts, format: "mp4" }),
    gif: estimateOutputBytes({ ...opts, format: "gif" }),
    webp: estimateOutputBytes({ ...opts, format: "webp" }),
  };
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function Editor({
  sessionId,
  source,
  origin,
  initialStatus,
  initialOutputExt,
  strings: s,
}: {
  sessionId: string;
  source: {
    filename: string;
    ext: string;
    bytes: number;
    duration: number;
    width: number;
    height: number;
    fps: number;
  };
  origin: {
    discordUserId: string | null;
    discordUsername: string | null;
    discordChannelId: string | null;
    discordGuildId: string | null;
    discordMessageId: string | null;
  };
  initialStatus: Status;
  initialOutputExt: string | null;
  strings: Strings;
}) {
  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  // State
  const [tool, setTool] = useState<Tool>("trim");
  const [trimIn, setTrimIn] = useState(0);
  const [trimOut, setTrimOut] = useState(source.duration);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const [captions, setCaptions] = useState<Caption[]>([]);
  const [activeCaptionId, setActiveCaptionId] = useState<string | null>(null);

  const [blurs, setBlurs] = useState<Blur[]>([]);
  const [activeBlurId, setActiveBlurId] = useState<string | null>(null);

  const [crop, setCrop] = useState<Crop | null>(null);

  const [speed, setSpeed] = useState(1);
  const [format, setFormat] = useState<"mp4" | "gif" | "webp">("mp4");
  const [fps, setFps] = useState(15);
  const [maxWidth, setMaxWidth] = useState<number>(0);
  const [quality, setQuality] = useState<Quality>("medium");

  // Colour grading (eq filter on the server). Neutral defaults.
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(1);
  const [saturation, setSaturation] = useState(1);

  // Single corner watermark (text only for MVP).
  const [watermark, setWatermark] = useState<Watermark>({
    text: "",
    position: "br",
    opacity: 0.8,
    fontSize: 20,
  });

  // Sticker overlays — multiple PNGs the user uploads via a file picker, then
  // drags / resizes in the preview.
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [activeStickerId, setActiveStickerId] = useState<string | null>(null);
  const [uploadingSticker, setUploadingSticker] = useState(false);

  const [status, setStatus] = useState<Status>(initialStatus);
  const [outputExt, setOutputExt] = useState<string | null>(initialOutputExt);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [previewSize, setPreviewSize] = useState({ w: 0, h: 0 });

  // Track preview canvas size so caption fontSize / blur radius can scale
  // proportionally. ResizeObserver fires whenever the layout shifts (window
  // resize, sidebar collapse, etc.) so the preview stays accurate.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setPreviewSize({ w: rect.width, h: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Speed slider must change real-time playback rate so the user can preview
  // how fast/slow the result will play.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = Math.max(0.0625, Math.min(16, speed));
  }, [speed]);

  // Sync video element with playing/seek
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      setCurrentTime(v.currentTime);
      // Loop within trim region
      if (v.currentTime >= trimOut - 0.05) {
        v.currentTime = trimIn;
      } else if (v.currentTime < trimIn) {
        v.currentTime = trimIn;
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [trimIn, trimOut]);

  // Poll status if rendering
  useEffect(() => {
    if (status !== "rendering") return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/editor/sessions/${sessionId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const j = await res.json();
        if (j.status === "rendered") {
          setStatus("rendered");
          setOutputExt(j.output?.ext || null);
          clearInterval(t);
        } else if (j.status === "failed") {
          setStatus("failed");
          setError(j.error || "Render failed");
          clearInterval(t);
        }
      } catch (e) {
        console.error("status poll", e);
      }
    }, 1500);
    return () => clearInterval(t);
  }, [status, sessionId]);

  // Tools
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };

  const seekTo = useCallback((sec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(trimIn, Math.min(trimOut, sec));
  }, [trimIn, trimOut]);

  // Timeline drag handlers
  const handlePointerOnTimeline = (
    e: React.PointerEvent<HTMLDivElement>,
    mode: "scrub" | "in" | "out"
  ) => {
    const el = timelineRef.current;
    if (!el) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (ev.clientX - rect.left) / rect.width)
      );
      const sec = ratio * source.duration;
      if (mode === "scrub") seekTo(sec);
      if (mode === "in") {
        setTrimIn((prev) => {
          const next = Math.max(0, Math.min(trimOut - 0.2, sec));
          if (videoRef.current) videoRef.current.currentTime = next;
          return next;
        });
      }
      if (mode === "out") {
        setTrimOut((prev) => {
          const next = Math.min(source.duration, Math.max(trimIn + 0.2, sec));
          return next;
        });
      }
    };
    const up = (ev: PointerEvent) => {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);

    // initial click
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width)
    );
    const sec = ratio * source.duration;
    if (mode === "scrub") seekTo(sec);
    if (mode === "in") setTrimIn(Math.max(0, Math.min(trimOut - 0.2, sec)));
    if (mode === "out")
      setTrimOut(Math.min(source.duration, Math.max(trimIn + 0.2, sec)));
  };

  // Captions
  const addCaption = () => {
    const c: Caption = {
      id: uid("cap"),
      text: "TEXT",
      x: 0.1,
      y: 0.1,
      fontSize: 48,
      color: "#fbbf24",
      background: "none",
    };
    setCaptions((prev) => [...prev, c]);
    setActiveCaptionId(c.id);
    setTool("text");
  };
  const updateCaption = (id: string, patch: Partial<Caption>) =>
    setCaptions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const removeCaption = (id: string) => {
    setCaptions((prev) => prev.filter((c) => c.id !== id));
    setActiveCaptionId((p) => (p === id ? null : p));
  };

  // Blurs
  const addBlur = () => {
    const b: Blur = {
      id: uid("blur"),
      x: 0.3,
      y: 0.3,
      w: 0.3,
      h: 0.2,
      intensity: 18,
    };
    setBlurs((prev) => [...prev, b]);
    setActiveBlurId(b.id);
    setTool("blur");
  };
  const updateBlur = (id: string, patch: Partial<Blur>) =>
    setBlurs((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const removeBlur = (id: string) => {
    setBlurs((prev) => prev.filter((b) => b.id !== id));
    setActiveBlurId((p) => (p === id ? null : p));
  };

  // Drag overlay items on the preview canvas
  type DragInit = {
    kind: "caption" | "blur" | "blur-resize" | "sticker";
    id: string;
    startNormX: number;
    startNormY: number;
    startW?: number;
    startH?: number;
  };
  const dragStateRef = useRef<DragInit | null>(null);
  const onPreviewPointerMove = useCallback(
    (e: PointerEvent) => {
      const init = dragStateRef.current;
      const el = previewRef.current;
      if (!init || !el) return;
      const rect = el.getBoundingClientRect();
      const xN = (e.clientX - rect.left) / rect.width;
      const yN = (e.clientY - rect.top) / rect.height;
      if (init.kind === "caption") {
        updateCaption(init.id, {
          x: Math.max(0, Math.min(0.98, xN)),
          y: Math.max(0, Math.min(0.95, yN)),
        });
      } else if (init.kind === "blur") {
        const dx = xN - init.startNormX;
        const dy = yN - init.startNormY;
        setBlurs((prev) =>
          prev.map((b) =>
            b.id === init.id
              ? {
                  ...b,
                  x: Math.max(0, Math.min(1 - b.w, b.x + dx)),
                  y: Math.max(0, Math.min(1 - b.h, b.y + dy)),
                }
              : b
          )
        );
        dragStateRef.current = {
          ...init,
          startNormX: xN,
          startNormY: yN,
        };
      } else if (init.kind === "blur-resize") {
        const newW = Math.max(0.05, Math.min(1, init.startW! + (xN - init.startNormX)));
        const newH = Math.max(0.05, Math.min(1, init.startH! + (yN - init.startNormY)));
        setBlurs((prev) =>
          prev.map((b) =>
            b.id === init.id
              ? {
                  ...b,
                  w: Math.min(newW, 1 - b.x),
                  h: Math.min(newH, 1 - b.y),
                }
              : b
          )
        );
      } else if (init.kind === "sticker") {
        const dx = xN - init.startNormX;
        const dy = yN - init.startNormY;
        setStickers((prev) =>
          prev.map((st) =>
            st.id === init.id
              ? {
                  ...st,
                  x: Math.max(0, Math.min(1 - st.scale, st.x + dx)),
                  y: Math.max(0, Math.min(0.98, st.y + dy)),
                }
              : st
          )
        );
        dragStateRef.current = {
          ...init,
          startNormX: xN,
          startNormY: yN,
        };
      }
    },
    []
  );
  const onPreviewPointerUp = useCallback((e: PointerEvent) => {
    dragStateRef.current = null;
    if (previewRef.current && e.pointerId)
      previewRef.current.releasePointerCapture(e.pointerId);
    document.removeEventListener("pointermove", onPreviewPointerMove);
    document.removeEventListener("pointerup", onPreviewPointerUp);
  }, [onPreviewPointerMove]);

  const startDrag = (
    e: React.PointerEvent<HTMLDivElement>,
    init: Omit<DragInit, "startNormX" | "startNormY">
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const el = previewRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragStateRef.current = {
      ...init,
      startNormX: (e.clientX - rect.left) / rect.width,
      startNormY: (e.clientY - rect.top) / rect.height,
    };
    document.addEventListener("pointermove", onPreviewPointerMove);
    document.addEventListener("pointerup", onPreviewPointerUp);
  };

  const startResizeBlur = (
    e: React.PointerEvent<HTMLDivElement>,
    blur: Blur
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const el = previewRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragStateRef.current = {
      kind: "blur-resize",
      id: blur.id,
      startNormX: (e.clientX - rect.left) / rect.width,
      startNormY: (e.clientY - rect.top) / rect.height,
      startW: blur.w,
      startH: blur.h,
    };
    document.addEventListener("pointermove", onPreviewPointerMove);
    document.addEventListener("pointerup", onPreviewPointerUp);
  };

  // Render
  const handleRender = async () => {
    setError(null);
    setStatus("rendering");
    const payload = {
      trimIn,
      trimOut,
      speed,
      format,
      fps: format === "gif" || format === "webp" ? fps : undefined,
      width: maxWidth > 0 ? maxWidth : undefined,
      crop,
      captions: captions.map((c) => ({
        text: c.text,
        x: c.x,
        y: c.y,
        fontSize: c.fontSize,
        color: c.color,
        background: c.background,
      })),
      blurs: blurs.map((b) => ({
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.h,
        intensity: b.intensity,
      })),
      quality,
      color:
        brightness !== 0 || contrast !== 1 || saturation !== 1
          ? { brightness, contrast, saturation }
          : undefined,
      watermark:
        watermark.text.trim().length > 0
          ? {
              text: watermark.text,
              position: watermark.position,
              opacity: watermark.opacity,
              fontSize: watermark.fontSize,
            }
          : undefined,
      stickers: stickers.map((st) => ({
        file: st.file,
        x: st.x,
        y: st.y,
        scale: st.scale,
      })),
    };
    try {
      const res = await fetch(`/api/editor/sessions/${sessionId}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const copyOutputLink = async () => {
    const url = new URL(
      `/api/editor/sessions/${sessionId}/output`,
      window.location.origin
    );
    try {
      await navigator.clipboard.writeText(url.toString());
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } catch {}
  };

  const aspectRatio = source.width && source.height
    ? source.width / source.height
    : 16 / 9;

  const trimDuration = Math.max(0, trimOut - trimIn);

  // Effective output dimensions after crop / maxWidth scaling.
  const effDimensions = useMemo(() => {
    const baseW = (crop ? crop.w : 1) * source.width;
    const baseH = (crop ? crop.h : 1) * source.height;
    const ratio = baseH > 0 ? baseW / baseH : 16 / 9;
    const w =
      maxWidth > 0 && maxWidth < baseW
        ? maxWidth
        : Math.max(2, Math.round(baseW));
    const h = Math.max(2, Math.round(w / ratio));
    return { w, h };
  }, [crop, source.width, source.height, maxWidth]);

  const estAll = useMemo(
    () =>
      estimateAllFormats({
        durationSec: trimDuration / Math.max(0.1, speed),
        width: effDimensions.w,
        height: effDimensions.h,
        fps,
      }),
    [trimDuration, speed, effDimensions, fps]
  );
  const estBytes = estAll[format];
  const estPct = Math.min(
    1,
    Math.max(0.005, estBytes / DISCORD_LIMIT_BYTES)
  );
  const estTooLarge = estBytes > DISCORD_LIMIT_BYTES;
  const cursorRatio = source.duration > 0 ? currentTime / source.duration : 0;

  // Tool buttons
  const TOOLS: { key: Tool; label: string; icon: React.ReactNode }[] = useMemo(
    () => [
      { key: "trim", label: s.panelTrim, icon: <ScissorsIcon className="size-5" weight="bold" /> },
      { key: "text", label: s.panelText, icon: <TextAaIcon className="size-5" weight="bold" /> },
      { key: "blur", label: s.panelBlur, icon: <EyeSlashIcon className="size-5" weight="bold" /> },
      { key: "crop", label: s.panelCrop, icon: <CropIcon className="size-5" weight="bold" /> },
      { key: "speed", label: s.panelSpeed, icon: <SpeedometerIcon className="size-5" weight="bold" /> },
      { key: "color", label: s.panelColor || "Колір", icon: <PaletteIcon className="size-5" weight="bold" /> },
      { key: "watermark", label: s.panelWatermark || "Водяний знак", icon: <CopyrightIcon className="size-5" weight="bold" /> },
      { key: "stickers", label: s.panelStickers || "Стікери", icon: <StickerIcon className="size-5" weight="bold" /> },
      { key: "output", label: s.panelOutput, icon: <ExportIcon className="size-5" weight="bold" /> },
    ],
    [s]
  );

  return (
    <div className="border-b border-[color:var(--border)] bg-[color:var(--background)]">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <Link
              href="/"
              className="inline-flex items-center gap-2 tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)] transition-colors"
            >
              <ArrowLeftIcon className="size-4" weight="bold" />
              {s.backToHome}
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2">
              {s.title}
            </h1>
            <div className="flex items-center gap-3 tactical-text text-[color:var(--muted)]">
              <span>{s.sessionId}: <span className="text-[color:var(--accent)]">{sessionId}</span></span>
              <span>·</span>
              <span>{Math.round(source.duration * 10) / 10}s</span>
              <span>·</span>
              <span>{source.width}×{source.height}</span>
              <span>·</span>
              <span>{Math.round(source.fps)}fps</span>
              {origin.discordUsername && (
                <>
                  <span>·</span>
                  <span>@{origin.discordUsername}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <div className="flex flex-col gap-1 min-w-[220px]">
              <div className="flex items-center justify-between gap-2 tactical-text">
                <span className="text-[color:var(--muted-2)]">
                  {s.discordLimit}
                </span>
                <span
                  className={`font-mono ${
                    estTooLarge
                      ? "text-red-400"
                      : estPct > 0.75
                        ? "text-yellow-300"
                        : "text-[color:var(--accent)]"
                  }`}
                >
                  {fmtBytes(estBytes)} / {DISCORD_LIMIT_MB} MB
                </span>
              </div>
              <div
                className="relative h-2 rounded-sm bg-[color:var(--background-elev)] border border-[color:var(--border-strong)] overflow-hidden"
                aria-label={s.discordLimit}
              >
                <div
                  className={`absolute inset-y-0 left-0 transition-all ${
                    estTooLarge
                      ? "bg-red-500"
                      : estPct > 0.75
                        ? "bg-yellow-400"
                        : "bg-[color:var(--accent)]"
                  }`}
                  style={{ width: `${estPct * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 tactical-text text-[10px]">
                <span className="text-[color:var(--muted-2)]">~оцінка по формату:</span>
                <span className="font-mono flex gap-2">
                  {(["mp4", "gif", "webp"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className={`${
                        format === f
                          ? "text-[color:var(--accent)] underline underline-offset-2"
                          : "text-[color:var(--muted-2)] hover:text-[color:var(--accent)]"
                      } ${
                        estAll[f] > DISCORD_LIMIT_BYTES ? "line-through decoration-red-400/70" : ""
                      }`}
                      title={`${f.toUpperCase()} ≈ ${fmtBytes(estAll[f])}`}
                    >
                      {f.toUpperCase()} {fmtBytes(estAll[f])}
                    </button>
                  ))}
                </span>
              </div>
              {estTooLarge ? (
                <span className="tactical-text text-[10px] text-red-400">
                  {s.tooLargeHint}
                </span>
              ) : (
                <span className="tactical-text text-[10px] text-[color:var(--muted)]">
                  {s.estimateHint}
                </span>
              )}
            </div>
            <span
              className={`tactical-text px-2 py-1 rounded-sm border ${
                status === "rendered"
                  ? "border-[color:var(--accent)] text-[color:var(--accent)]"
                  : status === "failed"
                    ? "border-red-500/40 text-red-400"
                    : status === "rendering"
                      ? "border-blue-400/40 text-blue-300"
                      : "border-[color:var(--border-strong)] text-[color:var(--muted-2)]"
              }`}
            >
              {s[STATUS_LABEL[status]]}
            </span>
            <button
              type="button"
              onClick={handleRender}
              disabled={status === "rendering"}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm bg-[color:var(--accent)] text-black font-mono text-xs uppercase tracking-[0.18em] font-bold hover:bg-[color:var(--accent-hard)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ExportIcon className="size-4" weight="bold" />
              {status === "rendering" ? s.rendering : s.render}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Tool rail */}
          <div className="lg:col-span-1 flex lg:flex-col gap-2 order-2 lg:order-none">
            {TOOLS.map((tdef) => (
              <button
                key={tdef.key}
                type="button"
                onClick={() => setTool(tdef.key)}
                aria-pressed={tool === tdef.key}
                className={`flex flex-col items-center gap-1 p-3 rounded-sm border transition-colors flex-1 lg:flex-initial ${
                  tool === tdef.key
                    ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                    : "border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--foreground)] hover:border-[color:var(--accent)]/40"
                }`}
              >
                {tdef.icon}
                <span className="tactical-text text-[10px]">{tdef.label}</span>
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className="lg:col-span-7 order-1 lg:order-none">
            <div
              ref={previewRef}
              className="relative w-full bg-black rounded-sm overflow-hidden border border-[color:var(--border-strong)]"
              style={{ aspectRatio: String(aspectRatio) }}
            >
              <video
                ref={videoRef}
                src={`/api/editor/sessions/${sessionId}/source`}
                className="absolute inset-0 w-full h-full object-contain"
                playsInline
                muted
                style={{
                  // Live crop preview via clip-path inset(top right bottom left).
                  ...(crop
                    ? {
                        clipPath: `inset(${(crop.y * 100).toFixed(2)}% ${(
                          (1 - crop.x - crop.w) *
                          100
                        ).toFixed(2)}% ${((1 - crop.y - crop.h) * 100).toFixed(
                          2
                        )}% ${(crop.x * 100).toFixed(2)}%)`,
                      }
                    : {}),
                  // Live colour preview. CSS `brightness` is multiplicative
                  // around 1 whereas ffmpeg `eq=brightness=` is additive around
                  // 0 — translate: CSS brightness ≈ 1 + ops.brightness.
                  filter: [
                    brightness !== 0 ? `brightness(${(1 + brightness).toFixed(3)})` : null,
                    contrast !== 1 ? `contrast(${contrast.toFixed(3)})` : null,
                    saturation !== 1 ? `saturate(${saturation.toFixed(3)})` : null,
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined,
                }}
              />
              {/* Crop overlay */}
              {crop && (
                <div className="absolute inset-0 pointer-events-none">
                  <div
                    className="absolute border-2 border-[color:var(--accent)] bg-[color:var(--accent)]/5"
                    style={{
                      left: `${crop.x * 100}%`,
                      top: `${crop.y * 100}%`,
                      width: `${crop.w * 100}%`,
                      height: `${crop.h * 100}%`,
                    }}
                  >
                    <span className="absolute top-1 left-1 tactical-text text-[10px] text-[color:var(--accent)] bg-black/60 px-1.5 py-0.5 rounded-sm">
                      CROP
                    </span>
                  </div>
                </div>
              )}
              {/* Blur regions */}
              {blurs.map((b) => (
                <div
                  key={b.id}
                  onPointerDown={(e) => {
                    setActiveBlurId(b.id);
                    setTool("blur");
                    startDrag(e, { kind: "blur", id: b.id });
                  }}
                  className={`absolute cursor-move ${
                    activeBlurId === b.id
                      ? "border-2 border-[color:var(--accent)]"
                      : "border border-white/40"
                  }`}
                  style={{
                    left: `${b.x * 100}%`,
                    top: `${b.y * 100}%`,
                    width: `${b.w * 100}%`,
                    height: `${b.h * 100}%`,
                    // Blur intensity in source pixels → scale to preview px so
                    // strength matches what ffmpeg will render. boxblur(x) in
                    // ffmpeg ≈ css blur(x*0.85), tuned by eye.
                    backdropFilter: `blur(${(
                      (b.intensity *
                        (previewSize.h || source.height)) /
                      Math.max(source.height, 1)
                    ).toFixed(2)}px)`,
                    WebkitBackdropFilter: `blur(${(
                      (b.intensity *
                        (previewSize.h || source.height)) /
                      Math.max(source.height, 1)
                    ).toFixed(2)}px)`,
                  }}
                >
                  <span className="absolute top-1 left-1 tactical-text text-[10px] text-white bg-black/60 px-1.5 py-0.5 rounded-sm">
                    BLUR
                  </span>
                  <div
                    onPointerDown={(e) => startResizeBlur(e, b)}
                    className="absolute -bottom-1 -right-1 size-4 rounded-sm bg-[color:var(--accent)] cursor-se-resize"
                  />
                </div>
              ))}
              {/* Captions */}
              {captions.map((c) => (
                <div
                  key={c.id}
                  onPointerDown={(e) => {
                    setActiveCaptionId(c.id);
                    setTool("text");
                    startDrag(e, { kind: "caption", id: c.id });
                  }}
                  style={{
                    left: `${c.x * 100}%`,
                    top: `${c.y * 100}%`,
                    // Caption fontSize in source pixels → preview pixels.
                    // previewSize.h is the rendered height of the preview;
                    // ratio = preview/source maps source-px to screen-px.
                    fontSize: `${(
                      (c.fontSize *
                        (previewSize.h || source.height)) /
                      Math.max(source.height, 1)
                    ).toFixed(2)}px`,
                    color: c.color,
                    background:
                      c.background === "black"
                        ? "rgba(0,0,0,0.55)"
                        : c.background === "white"
                          ? "rgba(255,255,255,0.85)"
                          : c.background === "yellow"
                            ? "rgba(251,191,36,0.92)"
                            : "transparent",
                    padding: c.background !== "none" ? "4px 12px" : 0,
                    border:
                      activeCaptionId === c.id
                        ? "1px dashed #fbbf24"
                        : "1px dashed transparent",
                  }}
                  className="absolute font-bold cursor-move whitespace-pre"
                >
                  {c.text || "TEXT"}
                </div>
              ))}
              {/* Watermark preview (text anchored in a corner). */}
              {watermark.text.trim().length > 0 && (
                <div
                  className="absolute pointer-events-none font-bold whitespace-pre"
                  style={{
                    top: watermark.position.startsWith("t") ? "12px" : undefined,
                    bottom: watermark.position.startsWith("b") ? "12px" : undefined,
                    left: watermark.position.endsWith("l") ? "12px" : undefined,
                    right: watermark.position.endsWith("r") ? "12px" : undefined,
                    fontSize: `${(
                      (watermark.fontSize *
                        (previewSize.h || source.height)) /
                      Math.max(source.height, 1)
                    ).toFixed(2)}px`,
                    color: `rgba(255,255,255,${watermark.opacity.toFixed(2)})`,
                    textShadow: `0 0 2px rgba(0,0,0,${(watermark.opacity * 0.6).toFixed(2)})`,
                  }}
                >
                  {watermark.text}
                </div>
              )}
              {/* Sticker overlays — draggable. */}
              {stickers.map((st) => (
                <div
                  key={st.id}
                  onPointerDown={(e) => {
                    setActiveStickerId(st.id);
                    setTool("stickers");
                    startDrag(e, { kind: "sticker", id: st.id });
                  }}
                  className={`absolute cursor-move ${
                    activeStickerId === st.id
                      ? "outline outline-2 outline-[color:var(--accent)]"
                      : ""
                  }`}
                  style={{
                    left: `${st.x * 100}%`,
                    top: `${st.y * 100}%`,
                    width: `${st.scale * 100}%`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={st.url}
                    alt="sticker"
                    draggable={false}
                    className="block w-full h-auto select-none pointer-events-none"
                  />
                </div>
              ))}
              {/* Play button */}
              <button
                type="button"
                onClick={togglePlay}
                className="absolute bottom-3 left-3 inline-flex items-center gap-2 px-3 h-9 rounded-sm bg-black/60 backdrop-blur-sm text-white tactical-text border border-white/20 hover:border-[color:var(--accent)] transition-colors"
              >
                {playing ? (
                  <PauseIcon className="size-4" weight="fill" />
                ) : (
                  <PlayIcon className="size-4" weight="fill" />
                )}
                {playing ? s.pause : s.play}
              </button>
              <span className="absolute bottom-3 right-3 tactical-text text-white bg-black/60 backdrop-blur-sm px-2 py-1 rounded-sm border border-white/20">
                {fmtTime(currentTime)} / {fmtTime(source.duration)}
              </span>
            </div>

            {/* Timeline */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="tactical-text text-[color:var(--muted)]">
                  {s.timeline}
                </span>
                <span className="tactical-text text-[color:var(--accent)]">
                  IN {fmtTime(trimIn)} → OUT {fmtTime(trimOut)} ({fmtTime(trimDuration)})
                </span>
              </div>
              <div
                ref={timelineRef}
                onPointerDown={(e) => handlePointerOnTimeline(e, "scrub")}
                className="relative h-12 rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--background-elev)] cursor-col-resize overflow-hidden select-none"
              >
                {/* Trim region */}
                <div
                  className="absolute top-0 bottom-0 bg-[color:var(--accent-soft)] border-x border-[color:var(--accent)]"
                  style={{
                    left: `${(trimIn / source.duration) * 100}%`,
                    right: `${100 - (trimOut / source.duration) * 100}%`,
                  }}
                />
                {/* Cursor */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none"
                  style={{ left: `${cursorRatio * 100}%` }}
                />
                {/* In handle */}
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    handlePointerOnTimeline(e, "in");
                  }}
                  className="absolute top-0 bottom-0 w-3 -ml-1.5 bg-[color:var(--accent)] cursor-ew-resize hover:bg-[color:var(--accent-hard)]"
                  style={{ left: `${(trimIn / source.duration) * 100}%` }}
                  title={s.inPoint}
                >
                  <ArrowsHorizontalIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-3 text-black" weight="bold" />
                </div>
                {/* Out handle */}
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    handlePointerOnTimeline(e, "out");
                  }}
                  className="absolute top-0 bottom-0 w-3 -ml-1.5 bg-[color:var(--accent)] cursor-ew-resize hover:bg-[color:var(--accent-hard)]"
                  style={{ left: `${(trimOut / source.duration) * 100}%` }}
                  title={s.outPoint}
                >
                  <ArrowsHorizontalIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-3 text-black" weight="bold" />
                </div>
                {/* Tick marks */}
                <div className="absolute inset-x-0 bottom-0 h-2 flex">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 border-r border-[color:var(--border)] last:border-r-0"
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between mt-1 tactical-text text-[10px] text-[color:var(--muted)]">
                <span>00:00</span>
                <span>{fmtTime(source.duration)}</span>
              </div>
            </div>
          </div>

          {/* Settings panel */}
          <div className="lg:col-span-4 order-3 lg:order-none">
            <div className="rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--background-elev)] p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="tactical-text text-[color:var(--accent)]">
                  {s.panel.toUpperCase()}: {(s as Strings)[`panel${tool.charAt(0).toUpperCase() + tool.slice(1)}` as keyof Strings] || tool}
                </span>
              </div>

              {/* TRIM */}
              {tool === "trim" && (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField
                      label={s.inPoint}
                      value={trimIn}
                      onChange={(v) => setTrimIn(Math.min(v, trimOut - 0.2))}
                      min={0}
                      max={source.duration}
                      step={0.05}
                      suffix="s"
                    />
                    <NumberField
                      label={s.outPoint}
                      value={trimOut}
                      onChange={(v) => setTrimOut(Math.max(v, trimIn + 0.2))}
                      min={0}
                      max={source.duration}
                      step={0.05}
                      suffix="s"
                    />
                  </div>
                  <div className="text-xs text-[color:var(--muted-2)]">
                    {s.duration}: {fmtTime(trimDuration)}
                  </div>
                </div>
              )}

              {/* TEXT */}
              {tool === "text" && (
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={addCaption}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-sm border border-[color:var(--border-strong)] hover:border-[color:var(--accent)] tactical-text"
                  >
                    <PlusIcon className="size-4" weight="bold" />
                    {s.addCaption}
                  </button>
                  <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
                    {captions.map((c) => (
                      <div
                        key={c.id}
                        className={`p-3 rounded-sm border cursor-pointer ${
                          activeCaptionId === c.id
                            ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                            : "border-[color:var(--border-strong)]"
                        }`}
                        onClick={() => setActiveCaptionId(c.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="tactical-text text-[color:var(--muted-2)]">
                            #{c.id.slice(-4)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCaption(c.id);
                            }}
                            className="text-[color:var(--muted)] hover:text-red-400"
                          >
                            <TrashIcon className="size-4" weight="bold" />
                          </button>
                        </div>
                        <input
                          value={c.text}
                          onChange={(e) =>
                            updateCaption(c.id, { text: e.target.value })
                          }
                          placeholder={s.captionText}
                          className="w-full mb-2 h-9 px-2 rounded-sm bg-[color:var(--background)] border border-[color:var(--border-strong)] text-sm focus:outline-none focus:border-[color:var(--accent)]"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <NumberField
                            label={s.captionSize}
                            value={c.fontSize}
                            onChange={(v) => updateCaption(c.id, { fontSize: v })}
                            min={12}
                            max={160}
                            step={2}
                            small
                          />
                          <ColorField
                            label={s.captionColor}
                            value={c.color}
                            onChange={(v) => updateCaption(c.id, { color: v })}
                          />
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <NumberField
                            label={s.posX}
                            value={c.x}
                            onChange={(v) => updateCaption(c.id, { x: v })}
                            min={0}
                            max={1}
                            step={0.01}
                            small
                          />
                          <NumberField
                            label={s.posY}
                            value={c.y}
                            onChange={(v) => updateCaption(c.id, { y: v })}
                            min={0}
                            max={1}
                            step={0.01}
                            small
                          />
                        </div>
                        <div className="mt-2 flex flex-col gap-1">
                          <span className="tactical-text text-[color:var(--muted-2)]">
                            {s.captionBackground}
                          </span>
                          <div className="grid grid-cols-4 gap-1">
                            {(["none", "black", "white", "yellow"] as const).map(
                              (bg) => (
                                <button
                                  key={bg}
                                  type="button"
                                  onClick={() =>
                                    updateCaption(c.id, { background: bg })
                                  }
                                  className={`h-8 rounded-sm border tactical-text text-[10px] ${
                                    c.background === bg
                                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                                      : "border-[color:var(--border-strong)] text-[color:var(--muted-2)]"
                                  }`}
                                >
                                  {(s as Strings)[`bg${bg.charAt(0).toUpperCase() + bg.slice(1)}` as keyof Strings] || bg}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BLUR */}
              {tool === "blur" && (
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={addBlur}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-sm border border-[color:var(--border-strong)] hover:border-[color:var(--accent)] tactical-text"
                  >
                    <PlusIcon className="size-4" weight="bold" />
                    {s.addBlur}
                  </button>
                  <div className="flex flex-col gap-2">
                    {blurs.map((b) => (
                      <div
                        key={b.id}
                        className={`p-3 rounded-sm border cursor-pointer ${
                          activeBlurId === b.id
                            ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                            : "border-[color:var(--border-strong)]"
                        }`}
                        onClick={() => setActiveBlurId(b.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="tactical-text text-[color:var(--muted-2)]">
                            #{b.id.slice(-4)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeBlur(b.id);
                            }}
                            className="text-[color:var(--muted)] hover:text-red-400"
                          >
                            <TrashIcon className="size-4" weight="bold" />
                          </button>
                        </div>
                        <NumberField
                          label={s.blurIntensity}
                          value={b.intensity}
                          onChange={(v) => updateBlur(b.id, { intensity: v })}
                          min={1}
                          max={100}
                          step={1}
                          small
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CROP */}
              {tool === "crop" && (
                <div className="flex flex-col gap-3">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={crop !== null}
                      onChange={(e) =>
                        setCrop(
                          e.target.checked
                            ? { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }
                            : null
                        )
                      }
                      className="accent-[color:var(--accent)]"
                    />
                    <span className="text-sm">{s.enableCrop}</span>
                  </label>
                  {crop && (
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField
                        label={s.cropX}
                        value={crop.x}
                        onChange={(v) =>
                          setCrop({ ...crop, x: Math.min(v, 0.9) })
                        }
                        min={0}
                        max={1}
                        step={0.01}
                      />
                      <NumberField
                        label={s.cropY}
                        value={crop.y}
                        onChange={(v) =>
                          setCrop({ ...crop, y: Math.min(v, 0.9) })
                        }
                        min={0}
                        max={1}
                        step={0.01}
                      />
                      <NumberField
                        label={s.cropW}
                        value={crop.w}
                        onChange={(v) =>
                          setCrop({ ...crop, w: Math.max(0.05, v) })
                        }
                        min={0.05}
                        max={1}
                        step={0.01}
                      />
                      <NumberField
                        label={s.cropH}
                        value={crop.h}
                        onChange={(v) =>
                          setCrop({ ...crop, h: Math.max(0.05, v) })
                        }
                        min={0.05}
                        max={1}
                        step={0.01}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* SPEED */}
              {tool === "speed" && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="tactical-text text-[color:var(--muted-2)]">
                      {s.speed}
                    </span>
                    <span className="font-mono text-sm">{speed.toFixed(2)}×</span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={4}
                    step={0.05}
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    className="w-full accent-[color:var(--accent)]"
                  />
                  <div className="grid grid-cols-4 gap-2">
                    {[0.5, 1, 1.5, 2].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSpeed(p)}
                        className={`h-9 rounded-sm border tactical-text ${
                          speed === p
                            ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                            : "border-[color:var(--border-strong)] text-[color:var(--muted-2)]"
                        }`}
                      >
                        {p}×
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* COLOR */}
              {tool === "color" && (
                <div className="flex flex-col gap-4">
                  <SliderField
                    label="Яскравість"
                    value={brightness}
                    onChange={setBrightness}
                    min={-1}
                    max={1}
                    step={0.05}
                    neutral={0}
                    format={(v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
                  />
                  <SliderField
                    label="Контраст"
                    value={contrast}
                    onChange={setContrast}
                    min={0}
                    max={2}
                    step={0.05}
                    neutral={1}
                    format={(v) => `${v.toFixed(2)}×`}
                  />
                  <SliderField
                    label="Насиченість"
                    value={saturation}
                    onChange={setSaturation}
                    min={0}
                    max={3}
                    step={0.05}
                    neutral={1}
                    format={(v) => `${v.toFixed(2)}×`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setBrightness(0);
                      setContrast(1);
                      setSaturation(1);
                    }}
                    className="h-9 rounded-sm border border-[color:var(--border-strong)] tactical-text text-[color:var(--muted-2)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                  >
                    Скинути
                  </button>
                  <p className="tactical-text text-[10px] text-[color:var(--muted)]">
                    Превью коригування — при рендері застосовується точно.
                    Зсунь слайдери щоб побачити ефект тут же.
                  </p>
                </div>
              )}

              {/* WATERMARK */}
              {tool === "watermark" && (
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="tactical-text text-[color:var(--muted-2)]">Текст</span>
                    <input
                      type="text"
                      value={watermark.text}
                      maxLength={80}
                      placeholder="@нік або назва клану"
                      onChange={(e) => setWatermark({ ...watermark, text: e.target.value })}
                      className="h-10 rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--background-elev)] px-3 tactical-text focus:outline-none focus:border-[color:var(--accent)]"
                    />
                  </label>
                  <div>
                    <span className="tactical-text text-[color:var(--muted-2)]">Позиція</span>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      {(["tl", "tr", "bl", "br"] as const).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => setWatermark({ ...watermark, position: pos })}
                          className={`h-9 rounded-sm border tactical-text ${
                            watermark.position === pos
                              ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                              : "border-[color:var(--border-strong)] text-[color:var(--muted-2)]"
                          }`}
                        >
                          {pos === "tl"
                            ? "↖ Зверху-ліво"
                            : pos === "tr"
                              ? "↗ Зверху-право"
                              : pos === "bl"
                                ? "↙ Знизу-ліво"
                                : "↘ Знизу-право"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <NumberField
                    label="Розмір"
                    value={watermark.fontSize}
                    onChange={(v) => setWatermark({ ...watermark, fontSize: v })}
                    min={10}
                    max={80}
                    step={1}
                    suffix="px"
                  />
                  <SliderField
                    label="Прозорість"
                    value={watermark.opacity}
                    onChange={(v) => setWatermark({ ...watermark, opacity: v })}
                    min={0.1}
                    max={1}
                    step={0.05}
                    neutral={0.8}
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                </div>
              )}

              {/* STICKERS */}
              {tool === "stickers" && (
                <div className="flex flex-col gap-3">
                  <p className="tactical-text text-[10px] text-[color:var(--muted)]">
                    PNG/WebP до 3 МБ, максимум 4 стікери. Перетягуй у превью.
                  </p>
                  <label
                    className={`h-10 rounded-sm border border-dashed flex items-center justify-center cursor-pointer tactical-text ${
                      stickers.length >= 4 || uploadingSticker
                        ? "border-[color:var(--border)] text-[color:var(--muted)] cursor-not-allowed"
                        : "border-[color:var(--accent)]/40 text-[color:var(--accent)] hover:bg-[color:var(--accent-soft)]"
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/png,image/webp"
                      className="hidden"
                      disabled={stickers.length >= 4 || uploadingSticker}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (!f) return;
                        if (stickers.length >= 4) return;
                        setUploadingSticker(true);
                        try {
                          const form = new FormData();
                          form.append("file", f);
                          const res = await fetch(
                            `/api/editor/sessions/${sessionId}/stickers`,
                            { method: "POST", body: form }
                          );
                          if (!res.ok) {
                            const j = await res.json().catch(() => ({}));
                            throw new Error(j.error || `HTTP ${res.status}`);
                          }
                          const j = (await res.json()) as { file: string };
                          const id = Math.random().toString(36).slice(2, 10);
                          const url = `/api/editor/sessions/${sessionId}/stickers?file=${encodeURIComponent(j.file)}`;
                          setStickers((prev) => [
                            ...prev,
                            { id, file: j.file, url, x: 0.3, y: 0.3, scale: 0.25 },
                          ]);
                          setActiveStickerId(id);
                        } catch (err) {
                          alert(`Не вдалося завантажити стікер: ${err instanceof Error ? err.message : err}`);
                        } finally {
                          setUploadingSticker(false);
                        }
                      }}
                    />
                    {uploadingSticker
                      ? "Завантажую…"
                      : stickers.length >= 4
                        ? "Максимум 4"
                        : "+ Додати стікер"}
                  </label>
                  {stickers.length === 0 ? (
                    <p className="tactical-text text-[10px] text-[color:var(--muted)]">
                      Поки що нема стікерів.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {stickers.map((st) => (
                        <div
                          key={st.id}
                          className={`flex items-center gap-2 p-2 rounded-sm border ${
                            activeStickerId === st.id
                              ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                              : "border-[color:var(--border-strong)]"
                          }`}
                          onClick={() => setActiveStickerId(st.id)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={st.url}
                            alt="sticker"
                            className="size-10 object-contain bg-black/40 rounded-sm"
                          />
                          <div className="flex-1 flex flex-col gap-1">
                            <SliderField
                              label="Розмір"
                              value={st.scale}
                              onChange={(v) =>
                                setStickers((prev) =>
                                  prev.map((x) =>
                                    x.id === st.id ? { ...x, scale: v } : x
                                  )
                                )
                              }
                              min={0.05}
                              max={1}
                              step={0.01}
                              neutral={0.25}
                              format={(v) => `${Math.round(v * 100)}%`}
                              compact
                            />
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStickers((prev) => prev.filter((x) => x.id !== st.id));
                              if (activeStickerId === st.id) setActiveStickerId(null);
                            }}
                            className="p-1.5 rounded-sm border border-[color:var(--border-strong)] text-red-400 hover:border-red-400"
                            aria-label="Видалити стікер"
                          >
                            <TrashIcon className="size-4" weight="bold" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* OUTPUT */}
              {tool === "output" && (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-3 gap-2">
                    {(["mp4", "gif", "webp"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormat(f)}
                        className={`h-12 rounded-sm border flex flex-col items-center justify-center gap-0.5 ${
                          format === f
                            ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                            : "border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:border-[color:var(--accent)]/40"
                        }`}
                      >
                        <span className="font-mono text-sm font-bold">{f.toUpperCase()}</span>
                        <span className="tactical-text text-[10px]">
                          {(s as Strings)[`format${f.charAt(0).toUpperCase() + f.slice(1)}` as keyof Strings]}
                        </span>
                      </button>
                    ))}
                  </div>
                  {(format === "gif" || format === "webp") && (
                    <NumberField
                      label={s.fps}
                      value={fps}
                      onChange={setFps}
                      min={8}
                      max={30}
                      step={1}
                      suffix="fps"
                    />
                  )}
                  <div>
                    <span className="tactical-text text-[color:var(--muted-2)]">
                      Якість
                    </span>
                    <div className="mt-1 grid grid-cols-3 gap-2">
                      {(["low", "medium", "high"] as const).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setQuality(q)}
                          className={`h-9 rounded-sm border tactical-text ${
                            quality === q
                              ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                              : "border-[color:var(--border-strong)] text-[color:var(--muted-2)]"
                          }`}
                          title={
                            q === "low"
                              ? "Швидше і менше. Для MP4 CRF=28."
                              : q === "high"
                                ? "Повільніше і більше. Для MP4 CRF=18."
                                : "За замовч. CRF=22."
                          }
                        >
                          {q === "low" ? "Низька" : q === "high" ? "Висока" : "Середня"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <NumberField
                    label={s.maxWidth}
                    value={maxWidth}
                    onChange={setMaxWidth}
                    min={0}
                    max={1920}
                    step={20}
                    suffix="px"
                  />
                  <span className="tactical-text text-[10px] text-[color:var(--muted)]">
                    0 = {s.maxWidth.toLowerCase()} = source
                  </span>
                </div>
              )}
            </div>

            {/* Output panel */}
            {(status === "rendered" || status === "failed") && (
              <div
                className={`mt-4 rounded-sm p-4 flex flex-col gap-3 ${
                  status === "rendered"
                    ? "border border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)]"
                    : "border border-red-500/40 bg-red-500/5"
                }`}
              >
                {status === "rendered" ? (
                  <>
                    <div className="flex items-center gap-2 text-[color:var(--accent)]">
                      <CheckCircleIcon className="size-5" weight="bold" />
                      <span className="font-bold">{s.rendered}</span>
                    </div>
                    {origin.discordChannelId ? (
                      <p className="text-sm text-[color:var(--muted-2)]">
                        {s.botWillSendBack}
                      </p>
                    ) : null}
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`/api/editor/sessions/${sessionId}/output?dl=1`}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-sm bg-[color:var(--accent)] text-black font-mono text-xs uppercase tracking-[0.18em] font-bold hover:bg-[color:var(--accent-hard)] transition-colors"
                      >
                        <DownloadIcon className="size-4" weight="bold" />
                        {s.download}
                      </a>
                      <button
                        type="button"
                        onClick={copyOutputLink}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-sm border border-[color:var(--accent)] text-[color:var(--accent)] font-mono text-xs uppercase tracking-[0.18em] font-bold hover:bg-[color:var(--accent-soft)] transition-colors"
                      >
                        <LinkIcon className="size-4" weight="bold" />
                        {linkCopied ? s.linkCopied : s.copyLink}
                      </button>
                    </div>
                    {outputExt === ".mp4" ? (
                      <video
                        key={outputExt + sessionId + status}
                        src={`/api/editor/sessions/${sessionId}/output`}
                        controls
                        playsInline
                        className="w-full rounded-sm border border-[color:var(--border-strong)] bg-black"
                      />
                    ) : outputExt === ".gif" || outputExt === ".webp" ? (
                      // Animated WebP (image/webp) and GIF are both image-format
                      // animations; browsers autoplay them inside <img>.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={outputExt + sessionId + status}
                        src={`/api/editor/sessions/${sessionId}/output`}
                        alt="output"
                        className="w-full rounded-sm border border-[color:var(--border-strong)] bg-black"
                      />
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-red-400">
                      <WarningCircleIcon className="size-5" weight="bold" />
                      <span className="font-bold">{s.failed}</span>
                    </div>
                    {error && (
                      <pre className="text-xs text-[color:var(--muted-2)] whitespace-pre-wrap font-mono">
                        {error}
                      </pre>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  small = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  small?: boolean;
}) {
  return (
    <label className={`flex flex-col ${small ? "gap-1" : "gap-1.5"}`}>
      <span className="tactical-text text-[color:var(--muted-2)] text-[10px]">
        {label}
        {suffix && (
          <span className="ml-1 text-[color:var(--muted)]">({suffix})</span>
        )}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) {
            onChange(Math.max(min, Math.min(max, v)));
          }
        }}
        min={min}
        max={max}
        step={step}
        className={`${small ? "h-8" : "h-9"} px-2 rounded-sm bg-[color:var(--background)] border border-[color:var(--border-strong)] text-sm font-mono focus:outline-none focus:border-[color:var(--accent)]`}
      />
    </label>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  neutral,
  format,
  compact = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  /** If provided, double-click on the slider resets to this value. */
  neutral?: number;
  format?: (v: number) => string;
  compact?: boolean;
}) {
  const fmt = format ?? ((v) => v.toFixed(2));
  const atNeutral = neutral !== undefined && Math.abs(value - neutral) < step / 2;
  return (
    <label className={`flex flex-col ${compact ? "gap-0.5" : "gap-1"}`}>
      <span className="flex items-center justify-between tactical-text text-[color:var(--muted-2)] text-[10px]">
        <span>{label}</span>
        <span
          className={`font-mono ${atNeutral ? "text-[color:var(--muted)]" : "text-[color:var(--accent)]"}`}
        >
          {fmt(value)}
        </span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => {
          if (neutral !== undefined) onChange(neutral);
        }}
        className="w-full accent-[color:var(--accent)]"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="tactical-text text-[color:var(--muted-2)] text-[10px]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-8 rounded-sm border border-[color:var(--border-strong)] bg-transparent cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-8 px-2 rounded-sm bg-[color:var(--background)] border border-[color:var(--border-strong)] text-sm font-mono focus:outline-none focus:border-[color:var(--accent)]"
        />
      </div>
    </label>
  );
}
