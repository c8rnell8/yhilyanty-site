import { useTranslations } from "next-intl";
import {
  RobotIcon,
  ArrowRightIcon,
  GithubLogoIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Link } from "@/i18n/navigation";

export function BotPromo() {
  const t = useTranslations("BotPromo");

  return (
    <section className="border-b border-[color:var(--border)]">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-20 lg:py-28">
        <div className="frame relative rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--background-elev)] p-8 sm:p-12">
          <div className="grid gap-10 lg:grid-cols-12 items-center">
            <div className="lg:col-span-7 flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <span className="tactical-text text-[color:var(--accent)]">
                  {t("eyebrow")}
                </span>
                <span className="tactical-text px-1.5 py-0.5 rounded-sm border border-[color:var(--accent)]/40 text-[color:var(--accent)]">
                  {t("badge")}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
                {t("title")}
              </h2>
              <p className="text-lg text-[color:var(--muted-2)] leading-relaxed">
                {t("body")}
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/bot"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-sm bg-[color:var(--accent)] text-black font-mono text-xs uppercase tracking-[0.18em] font-bold hover:bg-[color:var(--accent-hard)] transition-colors"
                >
                  <RobotIcon className="size-4" weight="bold" />
                  {t("openButton")}
                  <ArrowRightIcon className="size-4" weight="bold" />
                </Link>
                <a
                  href="https://github.com/c8rnell8/yhilbot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-sm border border-[color:var(--border-strong)] hover:border-[color:var(--accent)] font-mono text-xs uppercase tracking-[0.18em] transition-colors"
                >
                  <GithubLogoIcon className="size-4" weight="bold" />
                  GitHub
                </a>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-sm border border-[color:var(--border)] bg-black/40 p-5 font-mono text-xs leading-relaxed text-[color:var(--muted-2)]">
                <div className="flex items-center justify-between mb-3 text-[color:var(--accent)]">
                  <span>yhilbot ~ /examples</span>
                  <span>v5.2</span>
                </div>
                <pre className="whitespace-pre-wrap break-words">
{`> /gif file:clip.mp4 fps:18 width:540
  → clip.gif (3.2 MB) ✓

> /caption text:"squad leader doing
                squad leader things"
  → captioned.mp4 ✓

> /edit file:raid.mp4
  ┌──────────────────────────┐
  │ ▶ ●━━━━━━━○━━━━━━━━━━━━ │
  │   trim · text · blur     │
  └──────────────────────────┘`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
