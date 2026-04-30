import {
  TargetIcon,
  BroadcastIcon,
  ArrowRightIcon,
  DiscordLogoIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";

export function Games() {
  const t = useTranslations("Games");

  return (
    <section className="border-b border-[color:var(--border)]">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-20 lg:py-28">
        <div className="max-w-3xl flex flex-col gap-3 mb-14">
          <span className="tactical-text text-[color:var(--accent)]">{t("eyebrow")}</span>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            {t("title")}
          </h2>
          <p className="text-lg text-[color:var(--muted-2)] leading-relaxed mt-2">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {[
            { key: "squad" as const, icon: TargetIcon, accent: "01" },
            { key: "arma" as const, icon: BroadcastIcon, accent: "02" },
          ].map(({ key, icon: Icon, accent }) => {
            const discord = t(`${key}.discord`);
            return (
              <article
                key={key}
                className="frame relative rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-8 flex flex-col gap-5 group hover:border-[color:var(--accent)]/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 rounded-sm bg-[color:var(--accent-soft)] flex items-center justify-center shrink-0">
                      <Icon className="size-5 text-[color:var(--accent)]" weight="bold" />
                    </div>
                    <div className="flex flex-col leading-none min-w-0">
                      <span className="tactical-text">{accent}</span>
                      <span className="text-2xl font-bold tracking-tight truncate">
                        {t(`${key}.name`)}
                      </span>
                    </div>
                  </div>
                  <span className="tactical-text text-[color:var(--accent)] whitespace-nowrap pt-1">
                    {t(`${key}.tag`)}
                  </span>
                </div>

                <div className="flex items-center gap-2 -mt-1">
                  <span className="tactical-text">UNIT</span>
                  <span className="text-sm font-medium tracking-tight text-[color:var(--foreground)]">
                    {t(`${key}.unit`)}
                  </span>
                  <span className="tactical-text px-1.5 py-0.5 rounded-sm border border-[color:var(--accent)]/40 text-[color:var(--accent)]">
                    {t(`${key}.unitShort`)}
                  </span>
                </div>

                <p className="text-sm text-[color:var(--muted-2)] leading-relaxed">
                  {t(`${key}.body`)}
                </p>

                <div className="mt-auto pt-4 border-t border-[color:var(--border)] flex items-center justify-between gap-3">
                  <a
                    href={discord}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] text-[color:var(--foreground)] hover:text-[color:var(--accent)] transition-colors"
                  >
                    <DiscordLogoIcon className="size-4" weight="fill" />
                    {t("unitJoin")}
                  </a>
                  <ArrowRightIcon
                    className="size-4 text-[color:var(--accent)] transition-transform group-hover:translate-x-0.5"
                    weight="bold"
                  />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
