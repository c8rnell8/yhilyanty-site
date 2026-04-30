import { useTranslations } from "next-intl";

type Rule = { n: string; title: string; body: string };

export function Codex() {
  const t = useTranslations("Codex");
  const rules = (t.raw("rules") ?? []) as ReadonlyArray<Rule>;

  return (
    <section className="border-b border-[color:var(--border)]">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-20 lg:py-28">
        <div className="max-w-3xl flex flex-col gap-3 mb-14">
          <span className="tactical-text text-[color:var(--accent)]">{t("eyebrow")}</span>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            {t("title")}
          </h2>
        </div>

        <div className="grid gap-px bg-[color:var(--border)] sm:grid-cols-2 lg:grid-cols-4 border border-[color:var(--border)]">
          {rules.map((rule) => (
            <article
              key={rule.n}
              className="bg-[color:var(--background)] p-8 flex flex-col gap-3 hover:bg-[color:var(--background-elev)] transition-colors"
            >
              <span className="tactical-text text-[color:var(--accent)]">{rule.n}</span>
              <h3 className="text-xl font-bold tracking-tight">{rule.title}</h3>
              <p className="text-sm text-[color:var(--muted-2)] leading-relaxed">{rule.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
