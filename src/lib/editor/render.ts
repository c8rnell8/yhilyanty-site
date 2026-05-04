import { spawn } from "node:child_process";
import path from "node:path";
import { promises as fs } from "node:fs";

import {
  type EditOps,
  type EditorSession,
  type OutputFormat,
  sessionDir,
  writeSession,
} from "./session";

function escapeDrawtext(s: string): string {
  // ffmpeg drawtext uses '%{...}' macros and treats `:`, `\`, `'` specially.
  return s
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/\n/g, "\\n");
}

function safeColor(c: string): string {
  // allow #rrggbb, #rrggbbaa or named (white/black/yellow)
  if (/^#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(c.replace(/^#/, "")))
    return c.startsWith("#") ? c : `#${c}`;
  if (["white", "black", "yellow", "red", "green", "blue"].includes(c))
    return c;
  return "#fbbf24";
}

function findFontPath(): string {
  const candidates = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  ];
  for (const c of candidates) {
    try {
      // sync existsSync would be cleaner but we're in module scope; ok to try-fail
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      if (require("node:fs").existsSync(c)) return c;
    } catch {}
  }
  return candidates[0];
}

const FONT_PATH = findFontPath();

function buildFilterChain(
  ops: EditOps,
  src: { width: number; height: number }
): string {
  const filters: string[] = [];

  // Trim
  const trimIn = Math.max(0, ops.trimIn);
  const trimOut = Math.max(trimIn + 0.1, ops.trimOut);
  filters.push(`trim=start=${trimIn.toFixed(3)}:end=${trimOut.toFixed(3)}`);
  filters.push(`setpts=PTS-STARTPTS`);

  // Speed (visual only — audio handled separately later if added)
  if (ops.speed && ops.speed !== 1) {
    filters.push(`setpts=PTS/${ops.speed.toFixed(3)}`);
  }

  // Crop (normalized 0..1 → pixels). Apply before blur/captions for predictable
  // coordinates of subsequent effects.
  let outW = src.width;
  let outH = src.height;
  if (ops.crop) {
    const cw = Math.max(16, Math.round(src.width * ops.crop.w));
    const ch = Math.max(16, Math.round(src.height * ops.crop.h));
    const cx = Math.max(0, Math.round(src.width * ops.crop.x));
    const cy = Math.max(0, Math.round(src.height * ops.crop.y));
    filters.push(`crop=${cw}:${ch}:${cx}:${cy}`);
    outW = cw;
    outH = ch;
  }

  // Optional resize (max width)
  if (ops.width && ops.width > 0 && ops.width < outW) {
    const ratio = ops.width / outW;
    const nh = Math.round(outH * ratio / 2) * 2;
    filters.push(`scale=${ops.width}:${nh}`);
    outW = ops.width;
    outH = nh;
  }

  // Blur regions: do per-region by extracting + boxblur + overlay.
  // Implement using `split` chains. For each blur we add a parallel chain.
  let label = "[v]";
  filters.push(`format=yuv420p`); // ensure consistent before complex chain
  // Compose into a single graph using semicolons. Build as one pipeline first.
  const baseChain = filters.join(",");
  const parts: string[] = [`${baseChain}[base]`];
  let prev = "[base]";
  ops.blurs.forEach((b, i) => {
    const bw = Math.max(8, Math.round(outW * b.w));
    const bh = Math.max(8, Math.round(outH * b.h));
    const bx = Math.max(0, Math.round(outW * b.x));
    const by = Math.max(0, Math.round(outH * b.y));
    // ffmpeg's boxblur rejects radii > floor((min(w,h)-1)/2); clamp to avoid
    // "Invalid chars / Option failure" errors when the blur rectangle is small.
    const maxRadius = Math.max(1, Math.floor((Math.min(bw, bh) - 1) / 2));
    const intensity = Math.min(maxRadius, Math.max(1, Math.round(b.intensity)));
    const cropTag = `[blur${i}_src]`;
    const blurredTag = `[blur${i}]`;
    const overlayOut = i === ops.blurs.length - 1 ? `[blurred]` : `[afterblur${i}]`;
    parts.push(`${prev}split=2[${`bg${i}`}][toBlur${i}]`);
    parts.push(
      `[toBlur${i}]crop=${bw}:${bh}:${bx}:${by}${cropTag}`
    );
    parts.push(`${cropTag}boxblur=${intensity}:${intensity}${blurredTag}`);
    parts.push(
      `[bg${i}][${`bg${i}_keep`}]` // dummy; we'll re-map below
    );
    parts.pop(); // remove dummy
    parts.push(
      `[bg${i}]${blurredTag}overlay=${bx}:${by}${overlayOut}`
    );
    prev = overlayOut;
  });
  if (ops.blurs.length === 0) {
    parts[parts.length - 1] = `${baseChain}[blurred]`;
    prev = "[blurred]";
  }

  // Captions via drawtext. Chain on prev.
  if (ops.captions.length > 0) {
    let cur = prev;
    ops.captions.forEach((c, i) => {
      const text = escapeDrawtext(c.text || "");
      const color = safeColor(c.color || "#fbbf24");
      // Position: top-left anchor at normalized (x,y)
      const xpx = Math.round(outW * Math.min(0.98, Math.max(0, c.x)));
      const ypx = Math.round(outH * Math.min(0.95, Math.max(0, c.y)));
      const bgFlag =
        c.background === "black"
          ? `:box=1:boxcolor=black@0.55:boxborderw=12`
          : c.background === "white"
            ? `:box=1:boxcolor=white@0.85:boxborderw=12`
            : c.background === "yellow"
              ? `:box=1:boxcolor=#fbbf24@0.92:boxborderw=12`
              : "";
      const next =
        i === ops.captions.length - 1 ? `[v]` : `[cap${i}]`;
      parts.push(
        `${cur}drawtext=fontfile='${FONT_PATH}':text='${text}':fontcolor=${color}:fontsize=${Math.max(
          12,
          Math.round(c.fontSize)
        )}:x=${xpx}:y=${ypx}${bgFlag}${next}`
      );
      cur = next;
    });
    label = "[v]";
  } else {
    parts.push(`${prev}null[v]`);
    label = "[v]";
  }

  return parts.join(";") + ` -map "${label}"`;
}

function ffmpegArgs(
  inputPath: string,
  outputPath: string,
  ops: EditOps,
  src: { width: number; height: number }
): string[] {
  const filterAndMap = buildFilterChain(ops, src);
  const lastSemi = filterAndMap.lastIndexOf(" -map");
  const filter = filterAndMap.slice(0, lastSemi);
  const mapPart = filterAndMap.slice(lastSemi).trim().split(/\s+/);

  const args: string[] = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-filter_complex",
    filter,
    ...mapPart,
  ];

  if (ops.format === "gif") {
    // Two-pass palette would be better but single-pass with split is fine for MVP.
    const fps = ops.fps && ops.fps > 0 ? Math.min(30, ops.fps) : 15;
    args.push(
      "-vf",
      `fps=${fps},split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`
    );
    // Note: -vf on top of -filter_complex won't work. Simpler path: pipe via -an + gif palette.
  }

  if (ops.format === "mp4") {
    args.push(
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-an"
    );
  } else if (ops.format === "webp") {
    args.push("-c:v", "libwebp", "-loop", "0", "-an");
  }

  args.push(outputPath);
  return args;
}

export async function renderSession(s: EditorSession, ops: EditOps): Promise<void> {
  s.status = "rendering";
  s.ops = ops;
  s.error = null;
  await writeSession(s);

  const dir = sessionDir(s.id);
  const sourcePath = path.join(dir, `source${s.source.ext}`);

  // For GIF we use a separate two-pipe approach (filter_complex split palette).
  // For mp4/webp we use single filter_complex with effects.
  try {
    const outExt = ops.format === "gif" ? ".gif" : ops.format === "webp" ? ".webp" : ".mp4";
    const outputPath = path.join(dir, `output${outExt}`);

    // Sticker inputs: each sticker references a separate -i input by index
    // (1, 2, ...). Filter the sticker list ONCE here so the `-i` args and the
    // filter graph agree on which entries are present — otherwise stickers
    // with an empty sanitized name would get a filter reference to a ffmpeg
    // input index that was never added, and the render would fail with a
    // cryptic "Stream specifier [N:v] matches no streams" error.
    const stickerInputs: string[] = [];
    const validStickers: NonNullable<EditOps["stickers"]> = [];
    const rawStickerOps = Array.isArray(ops.stickers) ? ops.stickers.slice(0, 4) : [];
    for (const st of rawStickerOps) {
      if (!st.file || typeof st.file !== "string") continue;
      // Strictly scope the sticker path to the session dir to prevent escapes.
      const safe = st.file.replace(/[^a-zA-Z0-9._-]/g, "");
      if (!safe) continue;
      stickerInputs.push("-i", path.join(dir, safe));
      validStickers.push({ ...st, file: safe });
    }
    const renderOps: EditOps = { ...ops, stickers: validStickers };

    // Build a clean unified pipeline using filter_complex only (no -vf).
    const filter = buildUnifiedFilter(renderOps, s.source);

    const args: string[] = [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      sourcePath,
      ...stickerInputs,
      "-filter_complex",
      filter,
      "-map",
      "[out]",
    ];

    const quality: "low" | "medium" | "high" =
      ops.quality === "low" || ops.quality === "high" ? ops.quality : "medium";

    if (ops.format === "mp4") {
      const crf = quality === "low" ? 28 : quality === "high" ? 18 : 22;
      const preset =
        quality === "low" ? "ultrafast" : quality === "high" ? "slow" : "medium";
      args.push(
        "-c:v",
        "libx264",
        "-preset",
        preset,
        "-crf",
        String(crf),
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-an"
      );
    } else if (ops.format === "webp") {
      const q = quality === "low" ? 55 : quality === "high" ? 88 : 75;
      args.push(
        "-c:v",
        "libwebp",
        "-loop",
        "0",
        "-q:v",
        String(q),
        "-an"
      );
    }
    // Note: GIF quality is baked into the palette/dither config in the filter
    // graph — no codec-level knob exposed here.
    args.push(outputPath);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", args);
      let stderr = "";
      proc.stderr.on("data", (d) => (stderr += d.toString()));
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-2000)}`));
      });
    });

    const stat = await fs.stat(outputPath);
    s.output = {
      ext: outExt,
      bytes: stat.size,
      duration: Math.max(0, ops.trimOut - ops.trimIn) / Math.max(0.1, ops.speed),
    };
    s.renderGen = (s.renderGen || 0) + 1;
    s.status = "rendered";
    await writeSession(s);
  } catch (e) {
    s.status = "failed";
    s.error = e instanceof Error ? e.message : String(e);
    await writeSession(s);
    throw e;
  }
}

/** Build a single unified filter_complex pipeline that:
 *  - trims
 *  - speed
 *  - crops
 *  - resizes (optional)
 *  - applies blurs (one or more)
 *  - applies captions (one or more)
 *  - terminates at [out]
 *  - if format is gif, also runs palette gen/use at the end
 */
function buildUnifiedFilter(
  ops: EditOps,
  src: { width: number; height: number }
): string {
  const trimIn = Math.max(0, ops.trimIn);
  const trimOut = Math.max(trimIn + 0.1, ops.trimOut);
  const speed = Math.max(0.1, Math.min(8, ops.speed || 1));

  // Step 1: trim + reset PTS + speed
  let chain = `[0:v]trim=start=${trimIn.toFixed(3)}:end=${trimOut.toFixed(3)},setpts=(PTS-STARTPTS)/${speed.toFixed(3)}`;

  // Step 2: crop
  let outW = src.width;
  let outH = src.height;
  if (ops.crop) {
    const cw = Math.max(16, Math.round(src.width * ops.crop.w));
    const ch = Math.max(16, Math.round(src.height * ops.crop.h));
    const cx = Math.max(0, Math.round(src.width * ops.crop.x));
    const cy = Math.max(0, Math.round(src.height * ops.crop.y));
    chain += `,crop=${cw}:${ch}:${cx}:${cy}`;
    outW = cw;
    outH = ch;
  }

  // Step 3: resize
  if (ops.width && ops.width > 0 && ops.width < outW) {
    const ratio = ops.width / outW;
    const nh = Math.max(2, Math.round((outH * ratio) / 2) * 2);
    chain += `,scale=${ops.width}:${nh}`;
    outW = ops.width;
    outH = nh;
  }

  // Step 3b: color adjustments (brightness/contrast/saturation). Applied
  // before blurs so that the blurred regions inherit the colour-graded look
  // — otherwise a heavy saturation change would make the unblurred hotspot
  // look mismatched against the blurred surrounding.
  if (ops.color) {
    const b = Math.max(-1, Math.min(1, Number(ops.color.brightness) || 0));
    const c = Math.max(0, Math.min(2, Number(ops.color.contrast) || 1));
    const sat = Math.max(0, Math.min(3, Number(ops.color.saturation) || 1));
    if (b !== 0 || c !== 1 || sat !== 1) {
      chain += `,eq=brightness=${b.toFixed(3)}:contrast=${c.toFixed(3)}:saturation=${sat.toFixed(3)}`;
    }
  }

  chain += `,format=yuv420p[base]`;
  const parts: string[] = [chain];

  // Step 4: blurs (each: split → crop region → boxblur → overlay back)
  let prev = "[base]";
  ops.blurs.forEach((b, i) => {
    const bw = Math.max(8, Math.round(outW * b.w));
    const bh = Math.max(8, Math.round(outH * b.h));
    const bx = Math.max(0, Math.round(outW * b.x));
    const by = Math.max(0, Math.round(outH * b.y));
    const maxRadius = Math.max(1, Math.floor((Math.min(bw, bh) - 1) / 2));
    const intensity = Math.min(maxRadius, Math.max(1, Math.round(b.intensity)));
    parts.push(`${prev}split=2[bg${i}][src${i}]`);
    parts.push(
      `[src${i}]crop=${bw}:${bh}:${bx}:${by},boxblur=${intensity}:${intensity}[blur${i}]`
    );
    const overlayOut = `[afterblur${i}]`;
    parts.push(`[bg${i}][blur${i}]overlay=${bx}:${by}${overlayOut}`);
    prev = overlayOut;
  });

  // Step 4.5: sticker overlays. Each sticker is a separate -i input indexed
  // from 1 (0 is the source video). The caller is responsible for appending
  // the `-i <sticker_path>` flags in the order they appear in ops.stickers.
  const stickers = Array.isArray(ops.stickers) ? ops.stickers.slice(0, 4) : [];
  stickers.forEach((st, i) => {
    const inputIdx = i + 1; // video is [0:v]
    const sw = Math.max(8, Math.round(outW * Math.max(0.05, Math.min(1, st.scale || 0.2))));
    const sx = Math.max(0, Math.round(outW * Math.min(1, Math.max(0, st.x))));
    const sy = Math.max(0, Math.round(outH * Math.min(1, Math.max(0, st.y))));
    const prepared = `[stk${i}]`;
    // Scale the sticker input and force rgba so alpha channel is preserved.
    parts.push(`[${inputIdx}:v]scale=${sw}:-1,format=rgba${prepared}`);
    const overlayOut = `[afterstk${i}]`;
    parts.push(`${prev}${prepared}overlay=${sx}:${sy}${overlayOut}`);
    prev = overlayOut;
  });

  // Step 5: captions
  ops.captions.forEach((c, i) => {
    const text = escapeDrawtext(c.text || "");
    const color = safeColor(c.color || "#fbbf24");
    const xpx = Math.round(outW * Math.min(0.98, Math.max(0, c.x)));
    const ypx = Math.round(outH * Math.min(0.95, Math.max(0, c.y)));
    const bgFlag =
      c.background === "black"
        ? `:box=1:boxcolor=black@0.55:boxborderw=14`
        : c.background === "white"
          ? `:box=1:boxcolor=white@0.85:boxborderw=14`
          : c.background === "yellow"
            ? `:box=1:boxcolor=#fbbf24@0.92:boxborderw=14`
            : "";
    const next = `[cap${i}]`;
    parts.push(
      `${prev}drawtext=fontfile='${FONT_PATH}':text='${text}':fontcolor=${color}:fontsize=${Math.max(
        12,
        Math.round(c.fontSize)
      )}:x=${xpx}:y=${ypx}${bgFlag}${next}`
    );
    prev = next;
  });

  // Step 5.5: corner watermark (single text, anchored to a corner).
  const wm = ops.watermark;
  if (wm && typeof wm.text === "string" && wm.text.trim().length > 0) {
    const wmText = escapeDrawtext(wm.text.slice(0, 80));
    const wmSize = Math.max(10, Math.min(80, Math.round(wm.fontSize || 20)));
    const wmOpacity = Math.max(0, Math.min(1, Number(wm.opacity) || 0.8));
    // Anchor expressions use drawtext's w/h (text dimensions) and ffmpeg's
    // main_w/main_h (frame dimensions) variables. 12px margin from edges.
    let xExpr = "12";
    let yExpr = "12";
    if (wm.position === "tr") {
      xExpr = "main_w-text_w-12";
      yExpr = "12";
    } else if (wm.position === "bl") {
      xExpr = "12";
      yExpr = "main_h-text_h-12";
    } else if (wm.position === "br") {
      xExpr = "main_w-text_w-12";
      yExpr = "main_h-text_h-12";
    }
    const next = `[wm]`;
    parts.push(
      `${prev}drawtext=fontfile='${FONT_PATH}':text='${wmText}':fontcolor=white@${wmOpacity.toFixed(2)}:fontsize=${wmSize}:x=${xExpr}:y=${yExpr}:borderw=1:bordercolor=black@${(wmOpacity * 0.6).toFixed(2)}${next}`
    );
    prev = next;
  }

  // Step 6: terminate
  if (ops.format === "gif") {
    const fps = ops.fps && ops.fps > 0 ? Math.min(30, ops.fps) : 15;
    parts.push(
      `${prev}fps=${fps},split=2[gifs0][gifs1];[gifs0]palettegen=stats_mode=diff[pal];[gifs1][pal]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle[out]`
    );
  } else if (ops.format === "webp") {
    // Animated WebP is also frame-limited — without an fps filter the output
    // encodes every source frame (e.g. 60fps) which blows up size 2–4× past
    // what the client-side estimator (which assumes ops.fps) predicts.
    const fps = ops.fps && ops.fps > 0 ? Math.min(30, ops.fps) : 15;
    parts.push(`${prev}fps=${fps},null[out]`);
  } else {
    parts.push(`${prev}null[out]`);
  }

  return parts.join(";");
}

// keep ffmpegArgs export for potential reuse / testing
export { ffmpegArgs as _ffmpegArgsDeprecated };
