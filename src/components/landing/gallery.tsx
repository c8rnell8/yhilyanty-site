import { getTranslations } from "next-intl/server";
import { ShoppingCartIcon, ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import { Link } from "@/i18n/navigation";
import { GalleryCard } from "@/components/landing/gallery-card";
import { listMerchCatalog } from "@/lib/cms/merch-catalog";

type Locale = "ua" | "ru" | "en";

export async function Gallery({ locale }: { locale?: Locale } = {}) {
  const t = await getTranslations("Gallery");
  const items = await listMerchCatalog(locale ?? "ua");
  if (items.length === 0) return null;
  // Show up to 3 items in the landing-section preview.
  const preview = items.slice(0, 3);

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
          {preview.map((item) => {
            const photos = item.photos.map((src) => ({ src }));
            return (
              <article
                key={item.id}
                className="frame group relative rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] overflow-hidden flex flex-col hover:border-[color:var(--accent)]/40 transition-colors"
              >
                <GalleryCard
                  photos={photos}
                  alt={item.title}
                  badge={`UA-${item.code}`}
                  price={item.price || "—"}
                />
                <div className="p-4 flex items-center justify-between gap-3 border-t border-[color:var(--border)]">
                  <div className="flex flex-col">
                    <span className="text-base font-bold tracking-tight">
                      {item.title}
                    </span>
                    {item.shortDesc ? (
                      <span className="tactical-text text-[color:var(--muted-2)] line-clamp-1">
                        {item.shortDesc}
                      </span>
                    ) : null}
                  </div>
                  <Link
                    href={`/merch/${item.id}`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-sm bg-[color:var(--accent)] text-black font-mono text-[11px] uppercase tracking-[0.18em] font-bold hover:bg-[color:var(--accent-hard)] transition-colors whitespace-nowrap"
                  >
                    <ShoppingCartIcon className="size-3.5" weight="bold" />
                    {t("orderButton")}
                    <ArrowRightIcon className="size-3.5" weight="bold" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
