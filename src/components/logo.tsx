import type { CSSProperties } from "react";

/**
 * Inline-block bold "У" inside an open triangle of three disconnected
 * yellow segments. Used in navbar, footer, favicons.
 */
export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  const style: CSSProperties = { width: size, height: size };
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={style}
      aria-label="Ухилянти"
    >
      <UTriangle />
    </span>
  );
}

/**
 * Hero/poster mark — the same triangle but bigger, with extra tactical
 * decorations (corner ticks, pattern, "SQUAD · COMMUNITY" footer).
 */
export function BigUMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 280"
      className={className}
      aria-hidden
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern
          id="hatch"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="6" stroke="#fbbf24" strokeWidth="1" opacity="0.18" />
        </pattern>
        <linearGradient id="big-y" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="60%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>

      <rect
        x="2"
        y="2"
        width="236"
        height="276"
        fill="url(#hatch)"
        stroke="#fbbf24"
        strokeWidth="0.5"
        opacity="0.35"
      />

      <g stroke="#fbbf24" strokeWidth="1" opacity="0.5" fill="none">
        <path d="M14 14 L26 14 M14 14 L14 26" />
        <path d="M226 14 L214 14 M226 14 L226 26" />
        <path d="M14 266 L26 266 M14 266 L14 254" />
        <path d="M226 266 L214 266 M226 266 L226 254" />
      </g>

      {/* Centered triangle + У */}
      <g transform="translate(34, 34)">
        <UTriangleSvg size={172} fillId="big-y" />
      </g>

      <line x1="32" y1="246" x2="208" y2="246" stroke="#fbbf24" strokeWidth="1" opacity="0.5" />
      <text
        x="120"
        y="262"
        textAnchor="middle"
        fontFamily="var(--font-geist-mono), monospace"
        fontWeight="700"
        fontSize="9"
        letterSpacing="3"
        fill="#fbbf24"
        opacity="0.85"
      >
        SQUAD · COMMUNITY
      </text>
    </svg>
  );
}

/**
 * Compact triangle-with-У mark (no decorations). Renders in 100×100 viewBox.
 * Three yellow segments form an outward-pointing triangle with corner gaps;
 * a bold "У" sits in the geometric center.
 */
export function UTriangle({
  className = "",
  fillId = "u-triangle-grad",
}: {
  className?: string;
  fillId?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className || "w-full h-full"}
      aria-hidden
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="60%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <UTriangleSvg size={100} fillId={fillId} />
    </svg>
  );
}

/**
 * Inner triangle geometry — used by both Logo and BigUMark via a shared
 * group. `size` is the box edge in current SVG units; the path is drawn
 * inside (0,0..size,size).
 */
function UTriangleSvg({ size, fillId }: { size: number; fillId: string }) {
  // Triangle vertices (apex at top center, base bottom). 8% margin keeps
  // strokes inside the bounding box.
  const m = 0.08 * size;
  const A = { x: size / 2, y: m }; // apex
  const B = { x: m, y: size - m }; // bottom-left
  const C = { x: size - m, y: size - m }; // bottom-right

  // Each side gets a ~14% gap centred at its midpoint, so the three
  // segments don't connect at the vertices.
  const gap = 0.14;

  const seg = (
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const a = { x: p1.x + dx * gap, y: p1.y + dy * gap };
    const b = { x: p2.x - dx * gap, y: p2.y - dy * gap };
    return `M${a.x.toFixed(2)},${a.y.toFixed(2)} L${b.x.toFixed(2)},${b.y.toFixed(2)}`;
  };

  const stroke = size * 0.085;
  const letterSize = size * 0.55;

  return (
    <g>
      <path
        d={[seg(A, B), seg(B, C), seg(C, A)].join(" ")}
        stroke="#fbbf24"
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
      />
      <text
        x={size / 2}
        y={size * 0.56}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-geist-mono), monospace"
        fontWeight="900"
        fontSize={letterSize}
        fill={`url(#${fillId})`}
      >
        У
      </text>
    </g>
  );
}
