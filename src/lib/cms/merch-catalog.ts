/** Merge built-in merch translations with CMS-stored overrides + custom items.
 *
 *  Server-only — uses next-intl's `getTranslations` and the JSON CMS store.
 *  Returns a fully-resolved catalog for the requested locale, ready to render.
 */
import { getTranslations } from "next-intl/server";

import {
  DEFAULT_MERCH_IDS,
  type MerchItem,
  readImageOverridesMulti,
  readMerchStore,
} from "./store";

export type ResolvedMerchItem = {
  id: string;
  isDefault: boolean;
  code: string;
  title: string;
  price: string;
  shortDesc: string;
  longDesc: string;
  specs: string[];
  sizes: string[];
  badge: string | null;
  /** Photos in priority order: CMS-uploaded > legacy default fallback. */
  photos: string[];
  /** First photo or fallback path under /public. */
  primaryPhoto: string;
};

const DEFAULT_FALLBACK_PHOTO: Record<string, string> = {
  flag: "/flag.png",
  mug: "/mug.png",
  patches: "/patches.png",
};

function pickLocale(m: { ua?: string; ru?: string; en?: string } | undefined, locale: string): string {
  if (!m) return "";
  const lc = (locale || "ua").toLowerCase();
  if (lc === "ua" && m.ua) return m.ua;
  if (lc === "ru" && m.ru) return m.ru;
  if (lc === "en" && m.en) return m.en;
  return m.ua || m.ru || m.en || "";
}

function splitLines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function splitCsv(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Returns the fully-resolved catalog for a locale, in display order:
 *  visible defaults (in their original order) followed by custom items
 *  in the order they were added. */
export async function listMerchCatalog(locale: string): Promise<ResolvedMerchItem[]> {
  const [t, store, photoOverrides] = await Promise.all([
    getTranslations({ locale, namespace: "Merch" }),
    readMerchStore(),
    readImageOverridesMulti(),
  ]);

  const byId = new Map<string, MerchItem>(store.items.map((i) => [i.id, i]));
  const out: ResolvedMerchItem[] = [];

  // Built-in items (in declared order) — skip hidden ones.
  for (const id of DEFAULT_MERCH_IDS) {
    const ov = byId.get(id);
    if (ov?.hidden) continue;
    const titleDef = t(`items.${id}.title` as "items.flag.title");
    const priceDef = t(`items.${id}.price` as "items.flag.price");
    const descDef = t(`items.${id}.description` as "items.flag.description");
    const specsDef = (t.raw(`items.${id}.specs`) as string[]) ?? [];
    const sizesDef = (t.raw(`items.${id}.sizes`) as string[]) ?? [];

    const titleOv = pickLocale(ov?.title, locale);
    const shortOv = pickLocale(ov?.shortDesc, locale);
    const longOv = pickLocale(ov?.longDesc, locale);
    const specsOv = pickLocale(ov?.specs, locale);
    const sizesOv = ov?.sizes;
    const badgeOv = pickLocale(ov?.badge, locale);

    const photos = photoOverrides[`merch.${id}`] || [];
    const primary = photos[0] || DEFAULT_FALLBACK_PHOTO[id] || "/flag.png";

    out.push({
      id,
      isDefault: true,
      code: ov?.code || id.toUpperCase(),
      title: titleOv || titleDef,
      price: ov?.price || priceDef,
      shortDesc: shortOv || descDef,
      longDesc: longOv || shortOv || descDef,
      specs: specsOv ? splitLines(specsOv) : specsDef,
      sizes: sizesOv ? splitCsv(sizesOv) : sizesDef,
      badge: badgeOv || null,
      photos: photos.length ? photos : [primary],
      primaryPhoto: primary,
    });
  }

  // Custom items (any non-default id, not hidden).
  for (const item of store.items) {
    if ((DEFAULT_MERCH_IDS as readonly string[]).includes(item.id)) continue;
    if (item.hidden) continue;

    const photos = photoOverrides[`merch.${item.id}`] || [];
    const primary = photos[0] || "/flag.png";
    const title = pickLocale(item.title, locale) || item.id;
    const shortDesc = pickLocale(item.shortDesc, locale);
    const longDesc = pickLocale(item.longDesc, locale) || shortDesc;
    const specs = pickLocale(item.specs, locale);
    const badge = pickLocale(item.badge, locale);

    out.push({
      id: item.id,
      isDefault: false,
      code: item.code || item.id.toUpperCase(),
      title,
      price: item.price || "",
      shortDesc,
      longDesc,
      specs: specs ? splitLines(specs) : [],
      sizes: item.sizes ? splitCsv(item.sizes) : [],
      badge: badge || null,
      photos: photos.length ? photos : [primary],
      primaryPhoto: primary,
    });
  }

  return out;
}

export async function findMerchItemById(
  id: string,
  locale: string
): Promise<ResolvedMerchItem | null> {
  const all = await listMerchCatalog(locale);
  return all.find((it) => it.id === id) || null;
}
