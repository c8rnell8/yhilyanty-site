import type { CSSProperties } from "react";
import Image from "next/image";

import brandU from "../../public/brand-u.png";

/**
 * Compact triangle-with-У mark used in navbar, footer, and small UI badges.
 */
export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  const style: CSSProperties = { width: size, height: size };
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={style}
      aria-label="Ухилянти"
    >
      <Image
        src={brandU}
        alt="Ухилянти"
        width={size}
        height={size}
        className="w-full h-full object-contain"
        priority
      />
    </span>
  );
}

/**
 * Hero/poster mark — full-size triangle-with-У with extra tactical decorations
 * (hatch pattern, corner ticks, "SQUAD · COMMUNITY" footer).
 */
export function BigUMark({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 240 280"
        className="absolute inset-0 w-full h-full"
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

      {/* PNG mark, centred above the SVG decorations. Aspect 1:1. */}
      <div className="absolute inset-0 flex items-center justify-center px-[15%] pb-[12%]">
        <Image
          src={brandU}
          alt="Ухилянти"
          width={400}
          height={400}
          className="w-full h-full max-w-full max-h-full object-contain"
          priority
        />
      </div>
    </div>
  );
}
