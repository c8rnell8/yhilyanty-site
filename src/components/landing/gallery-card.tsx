"use client";

import { useState } from "react";

import { Lightbox } from "@/components/ui/lightbox";

type Photo = { src: string; alt?: string };

/** Card preview used by the landing Gallery. Shows the hero photo + a
 *  small dot strip if more than one photo exists. Click anywhere on the
 *  preview opens the Lightbox. */
export function GalleryCard({
  photos,
  alt,
  badge,
  price,
}: {
  photos: Photo[];
  alt: string;
  badge: string;
  price: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  if (photos.length === 0) return null;
  const hero = photos[0];

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setActive(0);
          setOpen(true);
        }}
        className="relative aspect-[3/2] block w-full text-left group"
        aria-label={`${alt} — відкрити фото`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero.src}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute top-3 left-3 right-3 flex justify-between">
          <span className="tactical-text text-[color:var(--accent)] bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm">
            {badge}
          </span>
          <span className="tactical-text text-white bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm">
            {price}
          </span>
        </div>
        {photos.length > 1 && (
          <div className="absolute bottom-3 right-3 flex gap-1 z-[1]">
            {photos.map((_, i) => (
              <span
                key={i}
                className={`block size-1.5 rounded-full ${
                  i === active ? "bg-[color:var(--accent)]" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        )}
        <span className="absolute bottom-3 left-3 tactical-text text-white bg-black/50 backdrop-blur-sm px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
          🔍 Збільшити
        </span>
      </button>
      <Lightbox
        images={photos}
        index={active}
        open={open}
        onClose={() => setOpen(false)}
        onIndexChange={setActive}
      />
    </>
  );
}
