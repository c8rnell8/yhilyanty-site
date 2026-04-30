import type { CSSProperties } from "react";

export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  const style: CSSProperties = { width: size, height: size };
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={style}
      aria-label="Ухилянти"
    >
      <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden>
        <defs>
          <linearGradient id="lg-y" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="62" height="62" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        <rect x="6" y="6" width="52" height="52" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.25" />
        <text
          x="32"
          y="46"
          textAnchor="middle"
          fontFamily="var(--font-geist-mono), monospace"
          fontWeight="900"
          fontSize="44"
          fill="url(#lg-y)"
        >
          У
        </text>
      </svg>
    </span>
  );
}

export function BigUMark({ className = "" }: { className?: string }) {
  // viewBox 240×280. The glyph "У" includes a descender (the tail), so we
  // align it with `dominantBaseline=central` and shift it slightly up so the
  // optical center of the cap+descender lands on the geometric center of the
  // frame. Font-size is tuned so cap+tail fit inside the 60..220 band.
  return (
    <svg viewBox="0 0 240 280" className={className} aria-hidden preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="big-y" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="60%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#fbbf24" strokeWidth="1" opacity="0.18" />
        </pattern>
      </defs>
      <rect x="2" y="2" width="236" height="276" fill="url(#hatch)" stroke="#fbbf24" strokeWidth="0.5" opacity="0.35" />

      {/* Crosshair-ish corner ticks for tactical feel */}
      <g stroke="#fbbf24" strokeWidth="1" opacity="0.5" fill="none">
        <path d="M14 14 L26 14 M14 14 L14 26" />
        <path d="M226 14 L214 14 M226 14 L226 26" />
        <path d="M14 266 L26 266 M14 266 L14 254" />
        <path d="M226 266 L214 266 M226 266 L226 254" />
      </g>

      <text
        x="120"
        y="140"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-geist-mono), monospace"
        fontWeight="900"
        fontSize="170"
        fill="url(#big-y)"
      >
        У
      </text>

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
