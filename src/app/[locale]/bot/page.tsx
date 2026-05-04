import { setRequestLocale, getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import {
  RobotIcon,
  GithubLogoIcon,
  DiscordLogoIcon,
  TerminalWindowIcon,
  CpuIcon,
  CodeIcon,
  CheckIcon,
  FilmStripIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Link } from "@/i18n/navigation";
import { StandaloneUploader } from "@/components/editor/standalone-uploader";
import { getSession } from "@/lib/auth";

const STACK = [
  "Python 3.11+",
  "discord.py 2.x",
  "FFmpeg",
  "Pillow",
  "psutil",
  "ruff",
];

const DISCORD_INVITE = "https://discord.com/invite/CcN3GzeSfk";
const GITHUB_URL = "https://github.com/c8rnell8/yhilbot";

type Cmd = { slash: string; summary: string; detail: string };

function CommandsList() {
  const t = useTranslations("Bot");
  const commands = t.raw("commands") as Cmd[];
  return (
    <div className="grid gap-3">
      {commands.map((cmd) => (
        <article
          key={cmd.slash}
          className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-5 hover:border-[color:var(--accent)]/40 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <code className="font-mono text-base text-[color:var(--accent)] font-bold">
              {cmd.slash}
            </code>
          </div>
          <p className="text-sm font-medium tracking-tight">{cmd.summary}</p>
          <p className="text-xs text-[color:var(--muted-2)] mt-1.5 leading-relaxed">
            {cmd.detail}
          </p>
        </article>
      ))}
    </div>
  );
}

function FeaturesList() {
  const t = useTranslations("Bot");
  const features = t.raw("features") as string[];
  return (
    <ul className="flex flex-col gap-3">
      {features.map((f) => (
        <li key={f} className="flex items-start gap-3">
          <span className="mt-1 inline-flex items-center justify-center size-5 rounded-sm bg-[color:var(--accent-soft)] text-[color:var(--accent)] shrink-0">
            <CheckIcon className="size-3.5" weight="bold" />
          </span>
          <span className="text-sm text-[color:var(--foreground)]">{f}</span>
        </li>
      ))}
    </ul>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Bot" });
  return { title: `${t("title")} — yhilbot` };
}

export default async function BotPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Bot" });
  const session = await getSession();

  return (
    <div className="border-b border-[color:var(--border)]">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-20 lg:py-28">
        {/* Hero */}
        <div className="grid gap-10 lg:grid-cols-12 items-start mb-20">
          <div className="lg:col-span-7 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="tactical-text text-[color:var(--accent)]">
                {t("eyebrow")}
              </span>
              <span className="tactical-text px-1.5 py-0.5 rounded-sm border border-[color:var(--accent)]/40 text-[color:var(--accent)]">
                {t("version")}
              </span>
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.95]">
              {t("title")}
            </h1>
            <p className="text-lg text-[color:var(--muted-2)] leading-relaxed max-w-xl">
              {t("subtitle")}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-sm bg-[color:var(--accent)] text-black font-mono text-xs uppercase tracking-[0.18em] font-bold hover:bg-[color:var(--accent-hard)] transition-colors"
              >
                <GithubLogoIcon className="size-4" weight="bold" />
                {t("openOnGithub")}
              </a>
              <a
                href={DISCORD_INVITE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-sm border border-[color:var(--border-strong)] hover:border-[color:var(--accent)] font-mono text-xs uppercase tracking-[0.18em] transition-colors"
              >
                <DiscordLogoIcon className="size-4" weight="fill" />
                {t("openInDiscord")}
              </a>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="frame rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--background-elev)] aspect-square flex items-center justify-center overflow-hidden">
              <div className="relative size-2/3 grid place-items-center">
                <div className="absolute inset-0 rounded-sm border border-[color:var(--accent)]/20 rotate-12" />
                <div className="absolute inset-2 rounded-sm border border-[color:var(--accent)]/30 -rotate-6" />
                <RobotIcon
                  className="size-32 text-[color:var(--accent)] relative"
                  weight="duotone"
                />
              </div>
            </div>
            <div className="flex justify-between tactical-text">
              <span>YHL-BOT · CORE</span>
              <span className="text-[color:var(--accent)]">DEPLOYED</span>
            </div>
          </div>
        </div>

        {/* Standalone editor uploader — opens the same editor used by the
            Discord /edit flow, but with no Discord delivery. Requires login. */}
        <div className="grid gap-10 lg:grid-cols-12 items-start mb-20 border-t border-[color:var(--border)] pt-16">
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 tactical-text text-[color:var(--accent)]">
              <FilmStripIcon className="size-4" weight="bold" />
              <span>{t("standaloneEyebrow")}</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              {t("standaloneTitle")}
            </h2>
            <p className="text-[color:var(--muted-2)]">{t("standaloneSubtitle")}</p>
          </div>
          <div className="lg:col-span-7">
            {session ? (
              <StandaloneUploader
                locale={locale}
                strings={{
                  drop: t("standaloneDrop"),
                  browse: t("standaloneBrowse"),
                  hint: t("standaloneHint"),
                  pleaseLogin: t("standaloneRequiresLogin"),
                  tooLarge: t("standaloneTooLarge"),
                  unsupported: t("standaloneUnsupported"),
                  uploading: t("standaloneUploading"),
                  uploadFailed: t("standaloneUploadFailed"),
                }}
              />
            ) : (
              <div className="rounded-sm border border-dashed border-[color:var(--border-strong)] p-8 text-center flex flex-col items-center gap-4">
                <p className="text-[color:var(--muted-2)]">
                  {t("standaloneRequiresLogin")}
                </p>
                <a
                  href={`/api/auth/login?next=/${locale}/bot`}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-sm bg-[color:var(--accent)] text-black font-mono text-xs uppercase tracking-[0.18em] font-bold hover:bg-[color:var(--accent-hard)] transition-colors"
                >
                  <DiscordLogoIcon className="size-4" weight="fill" />
                  Discord login
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Commands grid */}
        <div className="grid gap-12 lg:grid-cols-12 mb-20">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2 tactical-text text-[color:var(--accent)] mb-3">
              <TerminalWindowIcon className="size-4" weight="bold" />
              <span>SLASH-CMD</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              {t("commandsTitle")}
            </h2>
          </div>
          <div className="lg:col-span-8">
            <CommandsList />
          </div>
        </div>

        {/* Features + stack */}
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-2 tactical-text text-[color:var(--accent)] mb-3">
              <CpuIcon className="size-4" weight="bold" />
              <span>FEATURE-MATRIX</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-6">
              {t("featuresTitle")}
            </h2>
            <FeaturesList />
          </div>

          <div className="lg:col-span-5">
            <div className="flex items-center gap-2 tactical-text text-[color:var(--accent)] mb-3">
              <CodeIcon className="size-4" weight="bold" />
              <span>BUILT-WITH</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-6">
              {t("techStack")}
            </h2>
            <div className="flex flex-wrap gap-2">
              {STACK.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-[color:var(--border-strong)] font-mono text-xs"
                >
                  <span className="size-1.5 rounded-full bg-[color:var(--accent)]" />
                  {s}
                </span>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-[color:var(--border)]">
              <Link
                href="/"
                className="inline-flex items-center gap-2 tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)] transition-colors"
              >
                ← BACK TO BASE
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
