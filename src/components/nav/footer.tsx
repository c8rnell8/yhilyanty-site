import { DiscordLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";

import { Logo } from "@/components/logo";
import { Link } from "@/i18n/navigation";

const DISCORD_INVITE = "https://discord.com/invite/CcN3GzeSfk";

export type FooterItem = {
  id: string;
  label: string;
  href: string;
  external?: boolean;
};

function isExternal(href: string, explicit?: boolean): boolean {
  if (explicit) return true;
  return /^https?:\/\//i.test(href) || href.startsWith("mailto:");
}

export function Footer({
  owner: _owner = false,
  items,
}: {
  owner?: boolean;
  items: FooterItem[];
}) {
  const t = useTranslations("Footer");

  return (
    <footer className="border-t border-[color:var(--border)] mt-12">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-12 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Logo size={32} className="text-[color:var(--accent)]" />
            <div className="flex flex-col leading-none">
              <span className="font-mono text-sm tracking-[0.18em] uppercase">Ухилянти</span>
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[color:var(--muted)]">
                {t("tagline")}
              </span>
            </div>
          </div>
          <p className="text-xs text-[color:var(--muted)] mt-3 max-w-sm leading-relaxed">
            {t("rights")}
          </p>
        </div>

        <nav className="md:col-span-3 flex flex-col gap-2 text-sm font-mono uppercase tracking-[0.12em]">
          <span className="text-[color:var(--muted)] text-[11px]">NAV</span>
          {items.map((item) => {
            const ext = isExternal(item.href, item.external);
            const isAdmin = item.href === "/admin";
            const cls = isAdmin
              ? "text-[color:var(--accent)] hover:text-[color:var(--accent-hard)] transition-colors"
              : "text-[color:var(--muted-2)] hover:text-[color:var(--accent)] transition-colors";
            return ext ? (
              <a
                key={item.id}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cls}
              >
                {item.label}
              </a>
            ) : (
              <Link key={item.id} href={item.href as never} className={cls}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="md:col-span-4 flex flex-col gap-2 text-sm font-mono uppercase tracking-[0.12em]">
          <span className="text-[color:var(--muted)] text-[11px]">COMMS</span>
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[color:var(--muted-2)] hover:text-[color:var(--accent)] transition-colors"
          >
            <DiscordLogoIcon className="size-4" weight="fill" />
            {t("discord")}
          </a>
          <span className="text-[color:var(--muted)] text-[10px] mt-4">
            UA-CALLSIGN · 2024 — {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </footer>
  );
}
