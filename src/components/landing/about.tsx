import { CheckIcon } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";

export function About() {
  const t = useTranslations("About");
  const bullets = (t.raw("bullets") ?? []) as ReadonlyArray<string>;

  return (
    <section className="border-b border-[color:var(--border)]">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-20 lg:py-28 grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5 flex flex-col gap-3 lg:sticky lg:top-24 self-start">
          <span className="tactical-text text-[color:var(--accent)]">{t("eyebrow")}</span>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            {t("title")}
          </h2>
        </div>
        <div className="lg:col-span-7 flex flex-col gap-8">
          <p className="text-lg text-[color:var(--muted-2)] leading-relaxed max-w-2xl">
            {t("body")}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2">
            {bullets.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-3 p-4 rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)]"
              >
                <CheckIcon
                  className="size-4 mt-1 shrink-0 text-[color:var(--accent)]"
                  weight="bold"
                />
                <span className="text-sm text-[color:var(--muted-2)] leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
