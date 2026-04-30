import { getTranslations } from "next-intl/server";
import { ShoppingCartIcon, ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import { Link } from "@/i18n/navigation";
import { ContentImage } from "@/components/cms/content-image";

const ITEMS = [
  { key: "flag" as const, slot: "merch.flag", src: "/flag.png", price: "350 \u20b4" },
  { key: "mug" as const, slot: "merch.mug", src: "/mug.png", price: "280 \u20b4" },
  { key: "patches" as const, slot: "merch.patches", src: "/patches.png", price: "120 \u20b4" },
];

export async function Gallery() {
  const t = await getTranslations("Gallery");

  return (
    <section className="border-b border-[color:var(--border)]">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-12 mb-14">
          <div className="lg:col-span-5 flex flex-col gap-3">
            <span className="tactical-text text-[color:var(--accent)]">{t("eyebrow")}</span>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
              {t("title")}
            </h2>
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <p className="text-lg text-[color:var(--muted-2)] leading-relaxed">
              {t("body")}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {ITEMS.map((item) => (
            <article
              key={item.key}
              className="frame group relative rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] overflow-hidden flex flex-col hover:border-[color:var(--accent)]/40 transition-colors"
            >
              <div className="relative aspect-[3/2]">
                <ContentImage
                  slot={item.slot}
                  src={item.src}
                  alt={t(`items.${item.key}` as "items.flag")}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
                <div className="absolute top-3 left-3 right-3 flex justify-between">
                  <span className="tactical-text text-[color:var(--accent)] bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm">
                    UA-{item.key.toUpperCase()}
                  </span>
                  <span className="tactical-text text-white bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm">
                    {item.price}
                  </span>
                </div>
              </div>
              <div className="p-4 flex items-center justify-between gap-3 border-t border-[color:var(--border)]">
                <div className="flex flex-col">
                  <span className="text-base font-bold tracking-tight">
                    {t(`items.${item.key}` as "items.flag")}
                  </span>
                  <span className="tactical-text text-[color:var(--muted-2)]">
                    {t(`itemTags.${item.key}` as "itemTags.flag")}
                  </span>
                </div>
                <Link
                  href={`/merch/${item.key}`}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-sm bg-[color:var(--accent)] text-black font-mono text-[11px] uppercase tracking-[0.18em] font-bold hover:bg-[color:var(--accent-hard)] transition-colors whitespace-nowrap"
                >
                  <ShoppingCartIcon className="size-3.5" weight="bold" />
                  {t("orderButton")}
                  <ArrowRightIcon className="size-3.5" weight="bold" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
