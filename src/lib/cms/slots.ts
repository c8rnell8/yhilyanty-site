/** Registry of swappable image slots on the site.
 *
 * Each entry pairs a stable `key` with the default fallback path under /public.
 *
 * UI hints:
 *  - `label` shows in the admin /admin/images page.
 *  - `area` groups slots in the admin UI.
 *  - `aspect` is a CSS aspect-ratio hint for thumbnails (optional).
 *
 * Built-in static slots live in `BASE_IMAGE_SLOTS`. Merch items added through
 * the admin contribute their own dynamic slots — use `listImageSlots()` to get
 * the full merged list (used by /admin/images and /api/admin/images).
 */
import { listVisibleMerchIds, readMerchStore, type MerchItem } from "./store";

export type ImageSlot = {
  key: string;
  label: string;
  area: string;
  default: string;
  aspect?: string;
};

const DEFAULT_IMAGES: Record<string, string> = {
  "merch.flag": "/flag.png",
  "merch.mug": "/mug.png",
  "merch.patches": "/patches.png",
};

const DEFAULT_LABELS: Record<string, string> = {
  "merch.flag": "Прапор / Banner",
  "merch.mug": "Кружка / Mug",
  "merch.patches": "Шеврони / Patches",
};

/** Static base slots — unchanged between requests. */
export const BASE_IMAGE_SLOTS: ImageSlot[] = [
  {
    key: "merch.flag",
    label: DEFAULT_LABELS["merch.flag"],
    area: "merch",
    default: DEFAULT_IMAGES["merch.flag"],
    aspect: "1 / 1",
  },
  {
    key: "merch.mug",
    label: DEFAULT_LABELS["merch.mug"],
    area: "merch",
    default: DEFAULT_IMAGES["merch.mug"],
    aspect: "1 / 1",
  },
  {
    key: "merch.patches",
    label: DEFAULT_LABELS["merch.patches"],
    area: "merch",
    default: DEFAULT_IMAGES["merch.patches"],
    aspect: "1 / 1",
  },
];

function customLabelFor(item: MerchItem | undefined, id: string): string {
  const t = item?.title;
  return (
    t?.ua ||
    t?.ru ||
    t?.en ||
    `Мерч / ${id}`
  );
}

/** Async: returns the full set of image slots, including a slot per visible
 *  merch item (built-ins and custom). The catalog API uses this so that newly
 *  added merch items can have photos uploaded through /admin/images. */
export async function listImageSlots(): Promise<ImageSlot[]> {
  const ids = await listVisibleMerchIds();
  const store = await readMerchStore();
  const merchById = new Map(store.items.map((it) => [it.id, it]));
  const seen = new Set<string>();
  const out: ImageSlot[] = [];

  for (const slot of BASE_IMAGE_SLOTS) {
    seen.add(slot.key);
    const id = slot.key.replace(/^merch\./, "");
    if (!ids.includes(id)) continue; // hidden default
    const item = merchById.get(id);
    out.push({
      ...slot,
      label: item?.title?.ua || item?.title?.ru || item?.title?.en || slot.label,
    });
  }
  // Custom merch items
  for (const id of ids) {
    const key = `merch.${id}`;
    if (seen.has(key)) continue;
    const item = merchById.get(id);
    out.push({
      key,
      label: customLabelFor(item, id),
      area: "merch",
      default: "/flag.png",
      aspect: "1 / 1",
    });
  }
  return out;
}

/** @deprecated kept only for the few static call-sites that don't need merch
 *  items yet. Prefer `listImageSlots()` for admin / catalog code. */
export const IMAGE_SLOTS = BASE_IMAGE_SLOTS;
