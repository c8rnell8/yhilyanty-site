import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  ArrowLeftIcon,
  TagIcon,
  CheckCircleIcon,
  TruckIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Link } from "@/i18n/navigation";
import { OrderForm } from "@/components/merch/order-form";
import { ContentImage } from "@/components/cms/content-image";
import { readMerchStore, type Multi } from "@/lib/cms/store";

export const dynamicParams = true;

function pickMulti(m: Multi, locale: string): string {
  return m[locale as "ua"] || m.ua || m.en || m.ru || "";
}
const isVid = (u: string) => /\.(mp4|webm)$/i.test(u);

const ITEM_KEYS = ["flag", "mug", "patches"] as const;
type ItemKey = (typeof ITEM_KEYS)[number];

const IMAGES: Record<ItemKey, string> = {
  flag: "/flag.png",
  mug: "/mug.png",
  patches: "/patches.png",
};

const SLOTS: Record<ItemKey, string> = {
  flag: "merch.flag",
  mug: "merch.mug",
  patches: "merch.patches",
};

export function generateStaticParams() {
  const locales = ["ua", "ru", "en"] as const;
  return locales.flatMap((locale) =>
    ITEM_KEYS.map((item) => ({ locale, item }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; item: string }>;
}) {
  const { locale, item } = await params;
  if (!ITEM_KEYS.includes(item as ItemKey)) return {};
  const t = await getTranslations({ locale, namespace: "Merch" });
  const title = t(`items.${item as ItemKey}.title` as "items.flag.title");
  return { title: `${title} — Ухилянти` };
}

export default async function MerchItemPage({
  params,
}: {
  params: Promise<{ locale: string; item: string }>;
}) {
  const { locale, item } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Merch" });

  const formStringsBase = {
    formTitle: t("formTitle"),
    formIntro: t("formIntro"),
    discord: t("discord"),
    discordPlaceholder: t("discordPlaceholder"),
    callsign: t("callsign"),
    callsignPlaceholder: t("callsignPlaceholder"),
    phone: t("phone"),
    phonePlaceholder: t("phonePlaceholder"),
    city: t("city"),
    cityPlaceholder: t("cityPlaceholder"),
    qty: t("qty"),
    size: t("size"),
    sizeNotApplicable: t("sizeNotApplicable"),
    notes: t("notes"),
    notesPlaceholder: t("notesPlaceholder"),
    submit: t("submit"),
    successTitle: t("successTitle"),
    successBody: t("successBody"),
  };

  // Custom (admin-managed) product?
  if (!ITEM_KEYS.includes(item as ItemKey)) {
    const store = await readMerchStore();
    const product = store.products.find((p) => p.id === item);
    if (!product) notFound();
    const pTitle = pickMulti(product.title, locale);
    const pDesc = pickMulti(product.desc, locale);
    return (
      <div className="border-b border-[color:var(--border)]">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-12 lg:py-20">
          <Link href="/merch" className="inline-flex items-center gap-2 mb-8 tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)] transition-colors">
            <ArrowLeftIcon className="size-4" weight="bold" />
            {t("backToGallery")}
          </Link>
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-6 flex flex-col gap-6">
              <div className="frame relative rounded-sm border border-[color:var(--border-strong)] bg-black overflow-hidden aspect-[4/3]">
                {product.media[0] ? (
                  isVid(product.media[0]) ? (
                    <video src={product.media[0]} className="absolute inset-0 w-full h-full object-cover" controls muted playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.media[0]} alt={pTitle} className="absolute inset-0 w-full h-full object-cover" />
                  )
                ) : null}
                {product.price && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 tactical-text text-white bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm">
                    <TagIcon className="size-3" weight="bold" />
                    {product.price}
                  </span>
                )}
              </div>
              {product.media.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {product.media.slice(1, 5).map((m, i) =>
                    isVid(m) ? (
                      <video key={i} src={m} className="aspect-square object-cover rounded-sm border border-[color:var(--border)]" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={m} alt="" className="aspect-square object-cover rounded-sm border border-[color:var(--border)]" />
                    ),
                  )}
                </div>
              )}
              <div className="flex flex-col gap-3">
                <span className="tactical-text text-[color:var(--accent)]">{t("eyebrow")}</span>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">{pTitle}</h1>
                <p className="text-base text-[color:var(--muted-2)] leading-relaxed whitespace-pre-wrap">{pDesc}</p>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)]">
                <TruckIcon className="size-5 text-[color:var(--accent)] shrink-0 mt-0.5" weight="bold" />
                <span className="text-sm text-[color:var(--muted-2)]">{t("shipping")}</span>
              </div>
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              <div className="lg:sticky lg:top-24">
                <OrderForm
                  itemKey={product.id}
                  title={pTitle}
                  price={product.price}
                  sizes={product.sizes}
                  strings={formStringsBase}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const itemKey = item as ItemKey;

  const title = t(`items.${itemKey}.title` as "items.flag.title");
  const price = t(`items.${itemKey}.price` as "items.flag.price");
  const description = t(
    `items.${itemKey}.description` as "items.flag.description"
  );
  const specs = t.raw(`items.${itemKey}.specs`) as string[];
  const sizes = t.raw(`items.${itemKey}.sizes`) as string[];

  const formStrings = {
    formTitle: t("formTitle"),
    formIntro: t("formIntro"),
    discord: t("discord"),
    discordPlaceholder: t("discordPlaceholder"),
    callsign: t("callsign"),
    callsignPlaceholder: t("callsignPlaceholder"),
    phone: t("phone"),
    phonePlaceholder: t("phonePlaceholder"),
    city: t("city"),
    cityPlaceholder: t("cityPlaceholder"),
    qty: t("qty"),
    size: t("size"),
    sizeNotApplicable: t("sizeNotApplicable"),
    notes: t("notes"),
    notesPlaceholder: t("notesPlaceholder"),
    submit: t("submit"),
    successTitle: t("successTitle"),
    successBody: t("successBody"),
  };

  return (
    <div className="border-b border-[color:var(--border)]">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-12 lg:py-20">
        <Link
          href="/merch"
          className="inline-flex items-center gap-2 mb-8 tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)] transition-colors"
        >
          <ArrowLeftIcon className="size-4" weight="bold" />
          {t("backToGallery")}
        </Link>

        <div className="grid gap-10 lg:grid-cols-12">
          {/* Left: image + info */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <div className="frame relative rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--background-elev)] overflow-hidden aspect-[4/3]">
              <ContentImage
                slot={SLOTS[itemKey]}
                src={IMAGES[itemKey]}
                alt={title}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute top-3 left-3 right-3 flex justify-between">
                <span className="tactical-text text-[color:var(--accent)] bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm">
                  UA-{itemKey.toUpperCase()}
                </span>
                <span className="inline-flex items-center gap-1 tactical-text text-white bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm">
                  <TagIcon className="size-3" weight="bold" />
                  {price}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <span className="tactical-text text-[color:var(--accent)]">
                {t("eyebrow")}
              </span>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
                {title}
              </h1>
              <p className="text-base text-[color:var(--muted-2)] leading-relaxed">
                {description}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="tactical-text text-[color:var(--muted)]">
                {t("specs")}
              </h2>
              <ul className="flex flex-col gap-2">
                {specs.map((line) => (
                  <li key={line} className="flex items-start gap-3">
                    <CheckCircleIcon
                      className="size-5 text-[color:var(--accent)] shrink-0 mt-0.5"
                      weight="bold"
                    />
                    <span className="text-sm">{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)]">
              <TruckIcon
                className="size-5 text-[color:var(--accent)] shrink-0 mt-0.5"
                weight="bold"
              />
              <span className="text-sm text-[color:var(--muted-2)]">
                {t("shipping")}
              </span>
            </div>
          </div>

          {/* Right: form */}
          <div className="lg:col-span-6 lg:col-start-7">
            <div className="lg:sticky lg:top-24">
              <OrderForm
                itemKey={itemKey}
                title={title}
                price={price}
                sizes={sizes}
                strings={formStrings}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
