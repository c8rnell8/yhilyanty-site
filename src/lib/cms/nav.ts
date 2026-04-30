import type { Locale } from "@/i18n/routing";
import type { Multi, NavItem, NavOverrides } from "@/lib/cms/store";

export type ResolvedNavItem = {
  id: string;
  label: string;
  href: string;
  external?: boolean;
  locked?: boolean;
  key?: string;
};

/** Default navbar items. Used when no override is present.
 *  Keyed by i18n `Nav.*` slot so translations can stay in-tree.
 */
export const DEFAULT_NAVBAR_IDS: Array<{ id: string; href: string; key: string }> = [
  { id: "default-home", href: "/", key: "home" },
  { id: "default-join", href: "/join", key: "join" },
  { id: "default-roster", href: "/roster", key: "roster" },
  { id: "default-merch", href: "/merch", key: "merch" },
  { id: "default-bot", href: "/bot", key: "bot" },
];

export const DEFAULT_FOOTER_IDS = DEFAULT_NAVBAR_IDS;

const ADMIN_ID = "default-admin";

export function pickMulti(m: Multi | undefined, locale: Locale): string {
  if (!m) return "";
  return m[locale] || m.ua || m.en || m.ru || "";
}

/** Build default items using i18n translator function `t(key)`. */
export function buildDefaultNav(
  defaults: Array<{ id: string; href: string; key: string }>,
  t: (key: string) => string,
): ResolvedNavItem[] {
  return defaults.map((d) => ({
    id: d.id,
    label: t(d.key),
    href: d.href,
    locked: d.id === "default-home",
    key: d.key,
  }));
}

/** Resolve override items into a per-locale flat list. */
export function resolveOverrideItems(
  items: NavItem[] | null | undefined,
  locale: Locale,
): ResolvedNavItem[] {
  if (!items || items.length === 0) return [];
  return items.map((it) => ({
    id: it.id,
    label: pickMulti(it.label, locale) || "(без назви)",
    href: it.href,
    external: it.external,
    locked: it.locked,
  }));
}

/** Decide the final navbar for the current request.
 *  Appends an Admin entry (translated) if the viewer is the owner.
 */
export function resolveNavbar(
  overrides: NavOverrides,
  locale: Locale,
  isOwner: boolean,
  t: (key: string) => string,
  tAdmin: () => string,
): ResolvedNavItem[] {
  const base =
    overrides.navbar && overrides.navbar.length > 0
      ? resolveOverrideItems(overrides.navbar, locale)
      : buildDefaultNav(DEFAULT_NAVBAR_IDS, t);
  if (isOwner && !base.some((i) => i.href === "/admin")) {
    base.push({
      id: ADMIN_ID,
      label: tAdmin(),
      href: "/admin",
      locked: true,
    });
  }
  return base;
}

export function resolveFooter(
  overrides: NavOverrides,
  locale: Locale,
  isOwner: boolean,
  t: (key: string) => string,
  tAdmin: () => string,
): ResolvedNavItem[] {
  const base =
    overrides.footer && overrides.footer.length > 0
      ? resolveOverrideItems(overrides.footer, locale)
      : buildDefaultNav(DEFAULT_FOOTER_IDS, t);
  if (isOwner && !base.some((i) => i.href === "/admin")) {
    base.push({
      id: ADMIN_ID,
      label: tAdmin(),
      href: "/admin",
      locked: true,
    });
  }
  return base;
}
