import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlockRenderer } from "@/components/cms/block-renderer";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { findPageBySlug, type Multi } from "@/lib/cms/store";

function pick(m: Multi | undefined, locale: Locale): string {
  if (!m) return "";
  return m[locale] || m.ua || m.en || m.ru || "";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await findPageBySlug(slug).catch(() => null);
  if (!page) return {};
  return {
    title: pick(page.title, locale as Locale) || page.slug,
  };
}

export default async function DynamicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const page = await findPageBySlug(slug).catch(() => null);
  if (!page) notFound();

  const title = pick(page.title, locale as Locale) || page.slug;

  return (
    <article>
      <header className="border-b border-[color:var(--border)]">
        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-10 py-10">
          <Link
            href="/"
            className="tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)]"
          >
            ← ГОЛОВНА
          </Link>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
            {title}
          </h1>
        </div>
      </header>
      <div className="py-6">
        {page.blocks.map((b) => (
          <BlockRenderer key={b.id} block={b} locale={locale as Locale} />
        ))}
      </div>
    </article>
  );
}
