/** Registry of swappable image slots on the site.
 *
 * Each entry pairs a stable `key` with the default fallback path under /public.
 * Add a new slot here when you want a new spot to be admin-editable.
 *
 * UI hints:
 *  - `label` shows in the admin /admin/images page.
 *  - `area` groups slots in the admin UI.
 *  - `aspect` is a CSS aspect-ratio hint for thumbnails (optional).
 */
export type ImageSlot = {
  key: string;
  label: string;
  area: string;
  default: string;
  aspect?: string;
};

export const IMAGE_SLOTS: ImageSlot[] = [
  // Merch
  {
    key: "merch.flag",
    label: "Прапор / Banner",
    area: "merch",
    default: "/flag.png",
    aspect: "1 / 1",
  },
  {
    key: "merch.mug",
    label: "Кружка / Mug",
    area: "merch",
    default: "/mug.png",
    aspect: "1 / 1",
  },
  {
    key: "merch.patches",
    label: "Шеврони / Patches",
    area: "merch",
    default: "/patches.png",
    aspect: "1 / 1",
  },
];
