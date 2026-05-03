"use client";

import { useState } from "react";

import { Lightbox } from "@/components/ui/lightbox";
import type { Locale } from "@/i18n/routing";
import type { Multi } from "@/lib/cms/store";

function pick(m: Multi | undefined, locale: Locale): string {
  if (!m) return "";
  return m[locale] || m.ua || m.en || m.ru || "";
}

type GalleryItem = { id: string; src: string; caption?: Multi };

/** Renders a CMS gallery block with click-to-zoom. Capped at 5 items by caller. */
export function BlockGallery({
  items,
  locale,
}: {
  items: GalleryItem[];
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const photos = items.map((it) => ({
    src: it.src,
    alt: pick(it.caption, locale),
  }));
  return (
    <section className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-10 py-8">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {items.map((it, idx) => {
          const cap = pick(it.caption, locale);
          return (
            <figure
              key={it.id}
              className="rounded-sm overflow-hidden border border-[color:var(--border)]"
            >
              <button
                type="button"
                onClick={() => {
                  setActive(idx);
                  setOpen(true);
                }}
                className="relative w-full aspect-square bg-black block group"
                aria-label="Збільшити фото"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.src}
                  alt={cap || ""}
                  className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <span className="absolute bottom-2 right-2 tactical-text text-white bg-black/50 backdrop-blur-sm px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition">
                  🔍
                </span>
              </button>
              {cap && (
                <figcaption className="p-3 text-xs font-mono uppercase tracking-[0.14em] text-[color:var(--muted-2)]">
                  {cap}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
      <Lightbox
        images={photos}
        index={active}
        open={open}
        onClose={() => setOpen(false)}
        onIndexChange={setActive}
      />
    </section>
  );
}
