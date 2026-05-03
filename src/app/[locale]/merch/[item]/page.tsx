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
import { PhotoViewer } from "@/components/ui/photo-viewer";
import { findMerchItemById, listMerchCatalog } from "@/lib/cms/merch-catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; item: string }>;
}) {
  const { locale, item } = await params;
  const found = await findMerchItemById(item, locale);
  if (!found) return {};
  return { title: `${found.title} — Ухилянти` };
}

export default async function MerchItemPage({
  params,
}: {
  params: Promise<{ locale: string; item: string }>;
}) {
  const { locale, item } = await params;
  setRequestLocale(locale);
  const found = await findMerchItemById(item, locale);
  if (!found) {
    // If id is unknown OR is a hidden default → 404.
    notFound();
  }
  // Render-time check: ensure we have other items too (for back-link UX).
  await listMerchCatalog(locale);

  const t = await getTranslations({ locale, namespace: "Merch" });

  const photos = found.photos.map((src) => ({ src }));

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
          <div className="lg:col-span-6 flex flex-col gap-6">
            <div className="relative">
              <PhotoViewer photos={photos} alt={found.title} aspect="4 / 3" />
              <div className="pointer-events-none absolute top-3 left-3 right-3 flex justify-between z-10">
                <span className="tactical-text text-[color:var(--accent)] bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm">
                  UA-{found.code}
                </span>
                <span className="inline-flex items-center gap-1 tactical-text text-white bg-black/40 backdrop-blur-sm px-2 py-1 rounded-sm">
                  <TagIcon className="size-3" weight="bold" />
                  {found.price || "—"}
                </span>
              </div>
              {found.badge ? (
                <span className="absolute bottom-3 left-3 z-10 tactical-text text-black bg-[color:var(--accent)] px-2 py-1 rounded-sm font-bold">
                  {found.badge}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              <span className="tactical-text text-[color:var(--accent)]">
                {t("eyebrow")}
              </span>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
                {found.title}
              </h1>
              {found.longDesc ? (
                <p className="text-base text-[color:var(--muted-2)] leading-relaxed whitespace-pre-line">
                  {found.longDesc}
                </p>
              ) : null}
            </div>

            {found.specs.length > 0 ? (
              <div className="flex flex-col gap-3">
                <h2 className="tactical-text text-[color:var(--muted)]">
                  {t("specs")}
                </h2>
                <ul className="flex flex-col gap-2">
                  {found.specs.map((line) => (
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
            ) : null}

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

          <div className="lg:col-span-6 lg:col-start-7">
            <div className="lg:sticky lg:top-24">
              <OrderForm
                itemKey={found.id}
                title={found.title}
                price={found.price}
                sizes={found.sizes}
                strings={formStrings}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
