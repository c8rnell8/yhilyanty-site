import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  ShoppingCartIcon,
  ArrowRightIcon,
  TagIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Link } from "@/i18n/navigation";
import { listMerchCatalog } from "@/lib/cms/merch-catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Merch" });
  return { title: `${t("eyebrow")} — Ухилянти` };
}

export default async function MerchIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tg = await getTranslations({ locale, namespace: "Gallery" });
  const tm = await getTranslations({ locale, namespace: "Merch" });
  const items = await listMerchCatalog(locale);

  return (
    <div className="border-b border-[color:var(--border)]">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-12 mb-14">
          <div className="lg:col-span-7 flex flex-col gap-3">
            <span className="tactical-text text-[color:var(--accent)]">
              {tm("eyebrow")}
            </span>
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[0.95]">
              {tg("title")}
            </h1>
            <p className="text-lg text-[color:var(--muted-2)] leading-relaxed mt-2 max-w-2xl">
              {tg("body")}
            </p>
          </div>
          <div className="lg:col-span-4 lg:col-start-9 flex flex-col gap-2 self-end">
            <span className="tactical-text text-[color:var(--muted)]">
              SHIPPING
            </span>
            <span className="text-sm">{tm("shipping")}</span>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-12 text-center">
            <p className="tactical-text text-[color:var(--muted)] mb-2">
              CATALOG EMPTY
            </p>
            <p className="text-sm text-[color:var(--muted-2)]">
              {locale === "ru"
                ? "В каталоге пока нет товаров. Загляни позже."
                : locale === "en"
                  ? "No items in the catalog yet. Check back later."
                  : "У каталозі поки немає товарів. Загляньте пізніше."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="frame group relative rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] overflow-hidden flex flex-col hover:border-[color:var(--accent)]/40 transition-colors"
              >
                <div className="relative aspect-[3/2]">
                  <Image
                    src={item.primaryPhoto}
                    alt={item.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                    unoptimized={item.primaryPhoto.startsWith("/api/")}
                  />
                  <div className="absolute top-3 left-3 right-3 flex justify-between">
                    <span className="tactical-text text-[color:var(--accent)] bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm">
                      UA-{item.code}
                    </span>
                    <span className="inline-flex items-center gap-1 tactical-text text-white bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm">
                      <TagIcon className="size-3" weight="bold" />
                      {item.price || "—"}
                    </span>
                  </div>
                  {item.badge ? (
                    <span className="absolute bottom-3 left-3 tactical-text text-black bg-[color:var(--accent)] px-2 py-1 rounded-sm font-bold">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <h2 className="text-xl font-bold tracking-tight">
                    {item.title}
                  </h2>
                  {item.shortDesc ? (
                    <p className="text-sm text-[color:var(--muted-2)] leading-relaxed line-clamp-3">
                      {item.shortDesc}
                    </p>
                  ) : null}
                  <Link
                    href={`/merch/${item.id}`}
                    className="mt-auto inline-flex items-center justify-between gap-2 px-4 py-2.5 rounded-sm bg-[color:var(--accent)] text-black font-mono text-xs uppercase tracking-[0.18em] font-bold hover:bg-[color:var(--accent-hard)] transition-colors"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ShoppingCartIcon className="size-4" weight="bold" />
                      {tg("orderButton")}
                    </span>
                    <ArrowRightIcon className="size-4" weight="bold" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
