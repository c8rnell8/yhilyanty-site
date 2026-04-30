import {
  ArrowRightIcon,
  CheckCircleIcon,
  DiscordLogoIcon,
} from "@phosphor-icons/react/dist/ssr";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getDiscordConfig, getSession, avatarUrl } from "@/lib/auth";

const DISCORD_INVITE = "https://discord.com/invite/CcN3GzeSfk";

type Step = { n: string; title: string; body: string };

export default async function JoinPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Join");
  const tAuth = await getTranslations("Auth");
  const steps = (t.raw("steps") ?? []) as Step[];
  const reqs = (t.raw("requirements.items") ?? []) as ReadonlyArray<string>;

  const cfg = getDiscordConfig();
  const session = await getSession();

  return (
    <section className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-16 lg:py-24">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7 flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="tactical-text text-[color:var(--accent)]">{t("eyebrow")}</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              {t("title")}
            </h1>
            <p className="text-lg text-[color:var(--muted-2)] max-w-2xl mt-2">{t("subtitle")}</p>
          </div>

          <ol className="grid gap-px bg-[color:var(--border)] border border-[color:var(--border)]">
            {steps.map((s) => (
              <li
                key={s.n}
                className="bg-[color:var(--background-elev)] p-6 grid gap-4 sm:grid-cols-[80px_1fr]"
              >
                <span className="tactical-text text-[color:var(--accent)] sm:text-2xl sm:tracking-[0.16em]">
                  {s.n}
                </span>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-bold tracking-tight">{s.title}</h3>
                  <p className="text-sm text-[color:var(--muted-2)] leading-relaxed">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <aside className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-24 self-start">
          <div className="frame rounded-sm border border-[color:var(--accent)]/40 bg-[color:var(--background-elev)] p-6 flex flex-col gap-4">
            <span className="tactical-text text-[color:var(--accent)]">AUTH</span>
            {session ? (
              <>
                <div className="flex items-center gap-3 p-3 rounded-sm bg-black/30 border border-[color:var(--border)]">
                  {avatarUrl(session) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl(session) as string}
                      alt=""
                      className="size-10 rounded-full"
                    />
                  ) : (
                    <div className="size-10 rounded-full bg-[color:var(--accent-soft)] flex items-center justify-center text-[color:var(--accent)] font-mono">
                      {session.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col leading-tight">
                    <span className="font-mono text-sm">
                      {session.globalName || session.username}
                    </span>
                    <span className="font-mono text-[10px] text-[color:var(--muted)]">
                      ID · {session.id}
                    </span>
                  </div>
                </div>
                <a
                  href="/api/auth/logout"
                  className="inline-flex items-center justify-center gap-2 px-5 h-11 rounded-sm btn-ghost text-sm font-mono uppercase tracking-[0.16em]"
                >
                  {tAuth("signOut")}
                </a>
              </>
            ) : (
              <>
                <p className="text-sm text-[color:var(--muted-2)] leading-relaxed">
                  {cfg.enabled
                    ? "OAuth готовий. Натискай — переадресуємо на Discord."
                    : t("loginNote")}
                </p>
                <a
                  href={`/api/auth/login?returnTo=/${locale}/join`}
                  className="inline-flex items-center justify-center gap-2 px-5 h-11 rounded-sm btn-primary text-sm font-mono uppercase tracking-[0.16em]"
                >
                  <DiscordLogoIcon className="size-4" weight="fill" />
                  {t("loginCta")}
                </a>
                <a
                  href={DISCORD_INVITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-between gap-2 px-5 h-11 rounded-sm btn-ghost text-sm font-mono uppercase tracking-[0.16em]"
                >
                  Discord · invite
                  <ArrowRightIcon className="size-4" weight="bold" />
                </a>
              </>
            )}
          </div>

          <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-6 flex flex-col gap-4">
            <span className="tactical-text text-[color:var(--accent)]">{t("requirements.title")}</span>
            <ul className="flex flex-col gap-3">
              {reqs.map((r, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-[color:var(--muted-2)]">
                  <CheckCircleIcon
                    className="size-4 mt-0.5 shrink-0 text-[color:var(--accent)]"
                    weight="fill"
                  />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
