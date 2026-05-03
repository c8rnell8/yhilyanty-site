import Image from "next/image";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Block, Multi } from "@/lib/cms/store";
import { BlockGallery } from "@/components/cms/block-gallery";

function pick(m: Multi | undefined, locale: Locale): string {
  if (!m) return "";
  return m[locale] || m.ua || m.en || m.ru || "";
}

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href) || href.startsWith("mailto:");
}

/** Very small markdown-lite: blank lines → paragraphs, `**bold**`, `*italic*`, `[text](url)`. */
function renderRichText(src: string): React.ReactNode {
  const paragraphs = src.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return paragraphs.map((p, i) => (
    <p key={i} className="leading-relaxed text-[color:var(--muted-2)] mb-4 last:mb-0 whitespace-pre-line">
      {renderInline(p)}
    </p>
  ));
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
    if (m[1] && m[2]) {
      parts.push(
        <a
          key={k++}
          href={m[2]}
          target={isExternal(m[2]) ? "_blank" : undefined}
          rel={isExternal(m[2]) ? "noopener noreferrer" : undefined}
          className="text-[color:var(--accent)] underline hover:text-[color:var(--accent-hard)]"
        >
          {m[1]}
        </a>
      );
    } else if (m[3]) {
      parts.push(<strong key={k++}>{m[3]}</strong>);
    } else if (m[4]) {
      parts.push(<em key={k++}>{m[4]}</em>);
    }
    lastIdx = re.lastIndex;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

export function BlockRenderer({
  block,
  locale,
}: {
  block: Block;
  locale: Locale;
}) {
  switch (block.type) {
    case "hero-lite": {
      const eyebrow = pick(block.eyebrow, locale);
      const title = pick(block.title, locale);
      const body = pick(block.body, locale);
      return (
        <section className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-10 py-16 lg:py-24">
          {eyebrow && (
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-[color:var(--accent)] mb-4">
              {eyebrow}
            </div>
          )}
          {title && (
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              {title}
            </h1>
          )}
          {body && (
            <p className="text-lg text-[color:var(--muted-2)] leading-relaxed max-w-2xl">
              {body}
            </p>
          )}
        </section>
      );
    }
    case "rich-text": {
      const body = pick(block.body, locale);
      if (!body) return null;
      return (
        <section className="mx-auto max-w-[900px] px-4 sm:px-6 lg:px-10 py-8">
          <div className="prose prose-invert max-w-none">{renderRichText(body)}</div>
        </section>
      );
    }
    case "cta": {
      const label = pick(block.label, locale) || "→";
      const href = block.href || "#";
      const ext = block.external || isExternal(href);
      const cls =
        block.variant === "ghost"
          ? "inline-flex items-center justify-center gap-2 px-6 h-12 rounded-sm border border-[color:var(--border-strong)] text-sm font-mono uppercase tracking-[0.14em] hover:border-[color:var(--accent)] transition-colors"
          : "inline-flex items-center justify-center gap-2 px-6 h-12 rounded-sm btn-primary text-sm font-mono uppercase tracking-[0.14em] transition-colors";
      return (
        <section className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-10 py-8 flex justify-center">
          {ext ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
              {label}
            </a>
          ) : (
            <Link href={href as never} className={cls}>
              {label}
            </Link>
          )}
        </section>
      );
    }
    case "image": {
      if (!block.src) return null;
      const caption = pick(block.caption, locale);
      return (
        <figure className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-10 py-8">
          <div className="relative w-full aspect-[16/9] rounded-sm overflow-hidden border border-[color:var(--border)] bg-black">
            <Image
              src={block.src}
              alt={block.alt || caption || ""}
              fill
              className="object-contain"
              unoptimized={block.src.startsWith("/api/cms/")}
            />
          </div>
          {caption && (
            <figcaption className="mt-3 text-center text-xs text-[color:var(--muted)] font-mono uppercase tracking-[0.18em]">
              {caption}
            </figcaption>
          )}
        </figure>
      );
    }
    case "gallery": {
      if (!block.items || block.items.length === 0) return null;
      // Hard cap: at most 5 photos per gallery block.
      const items = block.items.slice(0, 5).filter((it) => it.src);
      if (items.length === 0) return null;
      return <BlockGallery items={items} locale={locale} />;
    }
    case "divider":
      return (
        <div className="mx-auto max-w-[900px] px-4 sm:px-6 lg:px-10 py-6">
          <hr className="border-0 h-px bg-[color:var(--border)]" />
        </div>
      );
    default:
      return null;
  }
}
