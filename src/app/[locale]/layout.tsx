import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Footer } from "@/components/nav/footer";
import { Navbar } from "@/components/nav/navbar";
import { routing, type Locale } from "@/i18n/routing";
import { avatarUrl, getDiscordConfig, getSession, isOwner } from "@/lib/auth";
import { resolveFooter, resolveNavbar } from "@/lib/cms/nav";
import { readNavOverrides } from "@/lib/cms/store";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  const session = await getSession();
  const owner = isOwner(session);
  const cfg = getDiscordConfig();
  const navSession = session
    ? {
        username: session.globalName || session.username,
        avatar: avatarUrl(session),
        owner,
      }
    : null;

  const navOverrides = await readNavOverrides().catch(() => ({}));
  const tNav = await getTranslations({ locale, namespace: "Nav" });
  const navbarItems = resolveNavbar(
    navOverrides,
    locale as Locale,
    owner,
    (k) => tNav(k as never),
    () => tNav("admin"),
  );
  const footerItems = resolveFooter(
    navOverrides,
    locale as Locale,
    owner,
    (k) => tNav(k as never),
    () => tNav("admin"),
  );

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-[100dvh] flex flex-col">
        <NextIntlClientProvider locale={locale}>
          <Navbar
            session={navSession}
            authEnabled={cfg.enabled}
            items={navbarItems}
          />
          <main className="flex-1">{children}</main>
          <Footer owner={owner} items={footerItems} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
