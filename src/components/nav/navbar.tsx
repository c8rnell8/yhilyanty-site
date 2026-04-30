"use client";

import { motion } from "framer-motion";
import {
  DiscordLogoIcon,
  ListIcon,
  XIcon,
  SignInIcon,
  SignOutIcon,
  CaretDownIcon,
  ShieldStarIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { LanguageSwitcher } from "@/components/nav/language-switcher";
import { Logo } from "@/components/logo";
import { Link, usePathname } from "@/i18n/navigation";

type NavSession = {
  username: string;
  avatar: string | null;
  owner: boolean;
};

export type NavbarItem = {
  id: string;
  label: string;
  href: string;
  external?: boolean;
};

const DISCORD_INVITE = "https://discord.com/invite/CcN3GzeSfk";

function isExternal(href: string, explicit?: boolean): boolean {
  if (explicit) return true;
  return /^https?:\/\//i.test(href) || href.startsWith("mailto:");
}

export function Navbar({
  session,
  authEnabled,
  items,
}: {
  session: NavSession | null;
  authEnabled: boolean;
  items: NavbarItem[];
}) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!userRef.current) return;
      if (!userRef.current.contains(e.target as Node)) setUserOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const navItems = items;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[color:var(--background)]/80 border-b border-[color:var(--border)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--accent)]/40 to-transparent" />
      <nav
        aria-label="Primary"
        className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 h-16 flex items-center gap-6"
      >
        <Link
          href="/"
          className="flex items-center gap-3 group"
          aria-label="Ухилянти"
        >
          <Logo size={32} className="text-[color:var(--accent)]" />
          <div className="flex flex-col leading-none">
            <span className="font-mono text-sm tracking-[0.18em] uppercase">Ухилянти</span>
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[color:var(--muted)]">
              Squad · Reforger
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-1 ml-6">
          {navItems.map((item) => {
            const ext = isExternal(item.href, item.external);
            const isActive = !ext && (
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)
            );
            const cls = "relative px-3 py-2 text-sm font-mono uppercase tracking-[0.12em] text-[color:var(--muted-2)] hover:text-[color:var(--foreground)] transition-colors";
            const content = (
              <>
                {item.label}
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-x-3 -bottom-px h-px bg-[color:var(--accent)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </>
            );
            return ext ? (
              <a
                key={item.id}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cls}
              >
                {content}
              </a>
            ) : (
              <Link
                key={item.id}
                href={item.href as never}
                aria-current={isActive ? "page" : undefined}
                className={cls}
              >
                {content}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />

          {/* Auth control */}
          {session ? (
            <div ref={userRef} className="relative">
              <button
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                className="inline-flex items-center gap-2 h-9 pl-1 pr-3 rounded-sm border border-[color:var(--border-strong)] hover:border-[color:var(--accent)] transition-colors"
                aria-haspopup="menu"
                aria-expanded={userOpen}
              >
                {session.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.avatar}
                    alt=""
                    className="size-7 rounded-sm object-cover"
                  />
                ) : (
                  <span className="size-7 rounded-sm bg-[color:var(--accent-soft)] grid place-items-center font-mono text-xs text-[color:var(--accent)]">
                    {session.username.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="hidden sm:inline font-mono text-xs uppercase tracking-[0.12em] max-w-[100px] truncate">
                  {session.username}
                </span>
                <CaretDownIcon className="size-3.5" weight="bold" />
              </button>
              {userOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 min-w-[200px] rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--background-elev)] shadow-lg overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-[color:var(--border)]">
                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--muted)]">
                      {t("loggedInAs")}
                    </div>
                    <div className="text-sm font-medium truncate">
                      {session.username}
                    </div>
                  </div>
                  {session.owner && (
                    <Link
                      href="/admin"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-mono uppercase tracking-[0.1em] text-[color:var(--accent)] hover:bg-white/5"
                    >
                      <ShieldStarIcon className="size-4" weight="bold" />
                      {t("adminPanel")}
                    </Link>
                  )}
                  <a
                    href="/api/auth/logout"
                    className="flex items-center gap-2 px-3 py-2 text-sm font-mono uppercase tracking-[0.1em] text-[color:var(--muted-2)] hover:bg-white/5 hover:text-[color:var(--foreground)]"
                  >
                    <SignOutIcon className="size-4" weight="bold" />
                    {t("logout")}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <a
              href={authEnabled ? "/api/auth/login" : "/join?auth=missing-config"}
              className="hidden sm:inline-flex items-center gap-2 px-3 h-9 rounded-sm border border-[color:var(--border-strong)] hover:border-[color:var(--accent)] text-sm font-mono uppercase tracking-[0.12em] transition-colors"
            >
              <SignInIcon className="size-4" weight="bold" />
              <span>{t("login")}</span>
            </a>
          )}

          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-2 px-4 h-9 rounded-sm btn-primary text-sm font-mono uppercase tracking-[0.12em] transition-colors active:scale-[0.98]"
          >
            <DiscordLogoIcon className="size-4" weight="fill" />
            <span>{t("discord")}</span>
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t("menuClose") : t("menuOpen")}
            className="md:hidden inline-flex size-9 items-center justify-center rounded-sm text-[color:var(--muted-2)] hover:text-[color:var(--foreground)] hover:bg-white/5 transition-colors"
          >
            {open ? (
              <XIcon className="size-5" weight="regular" />
            ) : (
              <ListIcon className="size-5" weight="regular" />
            )}
          </button>
        </div>
      </nav>

      {open && (
        <div
          id="mobile-nav"
          className="md:hidden border-t border-[color:var(--border)] px-4 py-4 flex flex-col gap-1"
        >
          {navItems.map((item) => {
            const ext = isExternal(item.href, item.external);
            const cls = "px-2 py-2 rounded-sm text-sm font-mono uppercase tracking-[0.12em] text-[color:var(--muted-2)] hover:text-[color:var(--foreground)] hover:bg-white/5";
            return ext ? (
              <a
                key={item.id}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className={cls}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.id}
                href={item.href as never}
                onClick={() => setOpen(false)}
                className={cls}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {session ? (
              <a
                href="/api/auth/logout"
                className="inline-flex items-center justify-center gap-2 h-10 rounded-sm border border-[color:var(--border-strong)] text-sm font-mono uppercase tracking-[0.12em]"
              >
                <SignOutIcon className="size-4" weight="bold" />
                {t("logout")}
              </a>
            ) : (
              <a
                href={authEnabled ? "/api/auth/login" : "/join?auth=missing-config"}
                className="inline-flex items-center justify-center gap-2 h-10 rounded-sm border border-[color:var(--border-strong)] text-sm font-mono uppercase tracking-[0.12em]"
              >
                <SignInIcon className="size-4" weight="bold" />
                {t("login")}
              </a>
            )}
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-10 rounded-sm btn-primary text-sm font-mono uppercase tracking-[0.12em]"
            >
              <DiscordLogoIcon className="size-4" weight="fill" />
              <span>{t("discord")}</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
