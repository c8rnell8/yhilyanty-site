import { setRequestLocale } from "next-intl/server";

import { About } from "@/components/landing/about";
import { BotPromo } from "@/components/landing/bot-promo";
import { Codex } from "@/components/landing/codex";
import { Gallery } from "@/components/landing/gallery";
import { Games } from "@/components/landing/games";
import { Hero } from "@/components/landing/hero";
import { JoinCta } from "@/components/landing/join-cta";
import { readLayoutOverrides } from "@/lib/cms/store";
import {
  LANDING_DEFAULT_ORDER,
  LANDING_SECTIONS,
} from "@/lib/cms/sections";

const SECTION_RENDERERS: Record<string, () => React.ReactNode> = {
  hero: () => <Hero />,
  about: () => <About />,
  games: () => <Games />,
  gallery: () => <Gallery />,
  codex: () => <Codex />,
  botPromo: () => <BotPromo />,
  joinCta: () => <JoinCta />,
};

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const allLayouts = await readLayoutOverrides().catch(
    () => ({}) as Record<string, { sections?: string[]; hidden?: string[] }>
  );
  const layout = allLayouts["landing"] || {};
  const savedOrder = Array.isArray(layout.sections) ? layout.sections : [];
  const hidden = new Set(Array.isArray(layout.hidden) ? layout.hidden : []);
  const known = new Set(LANDING_SECTIONS.map((s) => s.key));

  // Start from saved order, drop unknown keys, then append any defaults
  // that weren't present (so new sections always appear).
  const ordered: string[] = [];
  for (const k of savedOrder) if (known.has(k) && !ordered.includes(k)) ordered.push(k);
  for (const k of LANDING_DEFAULT_ORDER) if (!ordered.includes(k)) ordered.push(k);

  return (
    <>
      {ordered.map((k) => {
        if (hidden.has(k)) return null;
        const render = SECTION_RENDERERS[k];
        if (!render) return null;
        return <div key={k}>{render()}</div>;
      })}
    </>
  );
}
