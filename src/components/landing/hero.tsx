"use client";

import { motion } from "framer-motion";
import {
  ArrowRightIcon,
  DiscordLogoIcon,
  CrosshairIcon,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { BigUMark } from "@/components/logo";
import { Link } from "@/i18n/navigation";
import { discordDisplayName, useClientSession } from "@/lib/use-session";

const DISCORD_INVITE = "https://discord.com/invite/CcN3GzeSfk";

const spring = { type: "spring", stiffness: 380, damping: 32 } as const;

export function Hero() {
  const t = useTranslations("Hero");
  const { session } = useClientSession();
  const nick = discordDisplayName(session);
  const callsignText = nick ? `${t("callsignLabel")} — @${nick}` : t("callsign");

  return (
    <section className="relative overflow-hidden border-b border-[color:var(--border)]">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(1200px 600px at 80% -10%, rgba(251,191,36,0.08), transparent 70%)",
        }}
      />
      <div className="absolute left-0 right-0 top-0 h-px crosshatch opacity-50" aria-hidden />

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-20 lg:py-28 grid gap-12 lg:grid-cols-12 lg:items-center min-h-[calc(100dvh-4rem)]">
        <div className="lg:col-span-7 flex flex-col gap-7">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="flex items-center gap-3"
          >
            <CrosshairIcon className="size-3 text-[color:var(--accent)]" weight="bold" />
            <span className="tactical-text text-[color:var(--accent)]">{t("tag")}</span>
            <span className="h-px flex-1 max-w-[120px] bg-[color:var(--border-strong)]" />
            <span className="tactical-text">{callsignText}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.05 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.98]"
          >
            {t("title")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 }}
            className="text-lg lg:text-xl text-[color:var(--muted-2)] max-w-2xl leading-relaxed"
          >
            {t("subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.15 }}
            className="flex flex-wrap items-center gap-3 pt-2"
          >
            <Link
              href="/join"
              className="group inline-flex items-center gap-2 px-6 h-12 rounded-sm btn-primary text-sm font-mono uppercase tracking-[0.16em]"
            >
              {t("ctaJoin")}
              <ArrowRightIcon
                className="size-4 transition-transform group-hover:translate-x-0.5"
                weight="bold"
              />
            </Link>
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 h-12 rounded-sm btn-ghost text-sm font-mono uppercase tracking-[0.16em] transition-colors"
            >
              <DiscordLogoIcon className="size-4" weight="fill" />
              {t("ctaDiscord")}
            </a>
          </motion.div>

          <motion.dl
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 pt-10 border-t border-[color:var(--border)]"
          >
            {[
              { k: "members", v: "42" },
              { k: "ops", v: "28" },
              { k: "voice", v: "1.4K" },
              { k: "wins", v: "67%" },
            ].map((s) => (
              <div key={s.k} className="flex flex-col gap-1">
                <dd className="text-2xl font-mono font-bold text-[color:var(--accent)]">{s.v}</dd>
                <dt className="tactical-text">{t(`stats.${s.k}` as "stats.members")}</dt>
              </div>
            ))}
          </motion.dl>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...spring, delay: 0.1 }}
          className="lg:col-span-5 relative"
        >
          <div className="frame relative rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--background-elev)] overflow-hidden aspect-[6/7]">
            <BigUMark className="absolute inset-0 w-full h-full" />
            <div className="absolute top-3 left-3 right-3 flex justify-between">
              <span className="tactical-text text-[color:var(--accent)]">YHL-001</span>
              <span className="tactical-text">REC · LIVE</span>
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex justify-between">
              <span className="tactical-text">VECTOR · UA</span>
              <span className="tactical-text">{new Date().toISOString().slice(0, 10)}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
