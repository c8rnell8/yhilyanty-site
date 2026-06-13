import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  ShoppingCartIcon,
  ArrowRightIcon,
  TagIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Link } from "@/i18n/navigation";
import { ContentImage } from "@/components/cms/content-image";
import { readMerchStore, type Multi } from "@/lib/cms/store";

const ITEMS = [
  { key: "flag" as const, slot: "merch.flag", src: "/flag.png" },
  { key: "mug" as const, slot: "merch.mug", src: "/mug.png" },
  { key: "patches" as const, slot: "merch.patches", src: "/patches.png" },
];

function pickMulti(m: Multi, locale: string): string {
  return m[locale as "ua"] || m.ua || m.en || m.ru || "";
}
const isVideo = (u: string) => /\.(mp4|webm)$/i.test(u);

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

  const store = await readMerchStore();
  const custom = store.products;

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

        {custom.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {custom.map((p) => {
              const title = pickMulti(p.title, locale);
              const desc = pickMulti(p.desc, locale);
              const cover = p.media[0];
              return (
                <article
                  key={p.id}
                  className="frame group relative rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] overflow-hidden flex flex-col hover:border-[color:var(--accent)]/40 transition-colors"
                >
                  <div className="relative aspect-[3/2] bg-black">
                    {cover ? (
                      isVideo(cover) ? (
                        <video src={cover} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt={title} className="absolute inset-0 w-full h-full object-cover" />
                      )
                    ) : null}
                    <div className="absolute top-3 left-3 right-3 flex justify-end">
                      {p.price && (
                        <span className="inline-flex items-center gap-1 tactical-text text-white bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm">
                          <TagIcon className="size-3" weight="bold" />
                          {p.price}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-5 flex flex-col gap-3 flex-1">
                    <h2 className="text-xl font-bold tracking-tight">{title}</h2>
                    <p className="text-sm text-[color:var(--muted-2)] leading-relaxed line-clamp-3">
                      {desc}
                    </p>
                    <Link
                      href={`/merch/${p.id}`}
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
              );
            })}
          </div>
        ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {ITEMS.map((item) => {
            const title = tm(`items.${item.key}.title` as "items.flag.title");
            const price = tm(`items.${item.key}.price` as "items.flag.price");
            const desc = tm(
              `items.${item.key}.description` as "items.flag.description"
            );
            return (
              <article
                key={item.key}
                className="frame group relative rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] overflow-hidden flex flex-col hover:border-[color:var(--accent)]/40 transition-colors"
              >
                <div className="relative aspect-[3/2]">
                  <ContentImage
                    slot={item.slot}
                    src={item.src}
                    alt={title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                  <div className="absolute top-3 left-3 right-3 flex justify-between">
                    <span className="tactical-text text-[color:var(--accent)] bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm">
                      UA-{item.key.toUpperCase()}
                    </span>
                    <span className="inline-flex items-center gap-1 tactical-text text-white bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm">
                      <TagIcon className="size-3" weight="bold" />
                      {price}
                    </span>
                  </div>
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <h2 className="text-xl font-bold tracking-tight">{title}</h2>
                  <p className="text-sm text-[color:var(--muted-2)] leading-relaxed line-clamp-3">
                    {desc}
                  </p>
                  <Link
                    href={`/merch/${item.key}`}
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
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
