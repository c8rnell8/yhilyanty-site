"use client";

/** <PhotoViewer> — main photo + horizontal thumbnail strip.
 *  Click any photo or thumb opens the <Lightbox> for full-screen zoom & swipe.
 *  Renders gracefully even with a single photo (just hides the strip).
 */
import { useState } from "react";

import { Lightbox } from "./lightbox";

type Photo = { src: string; alt?: string };

export function PhotoViewer({
  photos,
  alt,
  className,
  aspect = "4 / 3",
}: {
  photos: Photo[];
  alt?: string;
  className?: string;
  aspect?: string;
}) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  if (photos.length === 0) return null;
  const current = photos[Math.min(active, photos.length - 1)];

  return (
    <div className={`flex flex-col gap-3 ${className || ""}`}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="frame group relative rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--background-elev)] overflow-hidden block w-full"
        style={{ aspectRatio: aspect }}
        aria-label="Відкрити фото"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.src}
          alt={current.alt || alt || ""}
          className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
          loading="eager"
        />
        <span className="absolute bottom-2 right-2 tactical-text text-white bg-black/50 backdrop-blur-sm px-2 py-1 rounded-sm">
          🔍 Збільшити
        </span>
      </button>

      {photos.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {photos.slice(0, 5).map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setActive(i);
                setOpen(true);
              }}
              className={`relative aspect-square rounded-sm overflow-hidden border ${
                i === active
                  ? "border-[color:var(--accent)]"
                  : "border-[color:var(--border)] hover:border-[color:var(--accent)]/60"
              }`}
              aria-label={`Фото ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.src}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      <Lightbox
        images={photos}
        index={active}
        open={open}
        onClose={() => setOpen(false)}
        onIndexChange={setActive}
      />
    </div>
  );
}
