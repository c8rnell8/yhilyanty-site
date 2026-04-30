import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export function JoinCta() {
  const t = useTranslations("JoinCta");

  return (
    <section>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-24">
        <div className="frame relative rounded-sm border border-[color:var(--accent)]/30 bg-[color:var(--background-elev)] p-10 lg:p-16 grid gap-10 lg:grid-cols-12 lg:items-center overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              background:
                "radial-gradient(600px 300px at 80% 50%, rgba(251,191,36,0.18), transparent 70%)",
            }}
            aria-hidden
          />
          <div className="relative lg:col-span-7 flex flex-col gap-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
              {t("title")}
            </h2>
            <p className="text-lg text-[color:var(--muted-2)] max-w-2xl">{t("subtitle")}</p>
          </div>
          <div className="relative lg:col-span-5 flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-end">
            <Link
              href="/join"
              className="group inline-flex items-center justify-between gap-3 px-6 h-12 rounded-sm btn-primary text-sm font-mono uppercase tracking-[0.16em] w-full sm:w-auto lg:w-full lg:max-w-xs"
            >
              {t("primary")}
              <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" weight="bold" />
            </Link>
            <Link
              href="/roster"
              className="inline-flex items-center justify-between gap-3 px-6 h-12 rounded-sm btn-ghost text-sm font-mono uppercase tracking-[0.16em] w-full sm:w-auto lg:w-full lg:max-w-xs"
            >
              {t("secondary")}
              <ArrowRightIcon className="size-4 opacity-60" weight="bold" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
