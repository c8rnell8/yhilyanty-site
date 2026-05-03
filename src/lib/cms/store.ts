/** CMS override storage — merges user-edited text/image overrides on top of defaults.
 *
 * Persistence is plain JSON files in $CMS_DIR (default: .cms-overrides/).
 *  - text.json:    { "ua": { "Hero.title": "..." }, "ru": {...}, "en": {...} }
 *  - images.json:  { "<key>": "/api/cms/images/<file>" }
 *  - layout.json:  { "<page>": { "sections": ["hero","games",...], "hidden": ["gallery"] } }
 *
 * All writes are atomic (write to .tmp then rename) and serialized via a
 * per-file mutex to avoid lost updates under concurrent admin saves.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export const CMS_DIR =
  process.env.CMS_DIR ||
  path.join(process.cwd(), ".cms-overrides");

export const IMAGES_DIR = path.join(CMS_DIR, "images");

export const TEXT_FILE = path.join(CMS_DIR, "text.json");
export const IMAGES_FILE = path.join(CMS_DIR, "images.json");
export const LAYOUT_FILE = path.join(CMS_DIR, "layout.json");
export const PAGES_FILE = path.join(CMS_DIR, "pages.json");
export const NAV_FILE = path.join(CMS_DIR, "nav.json");
export const MERCH_FILE = path.join(CMS_DIR, "merch.json");

export type TextOverrides = Record<string, Record<string, string>>;
/** Persisted shape: slot → string OR string[]; legacy single strings stay
 *  back-compatible. Use `readImageOverridesMulti` for the always-array shape. */
export type ImageOverridesRaw = Record<string, string | string[]>;
/** Legacy: only the *first* override URL per slot (back-compat for ContentImage). */
export type ImageOverrides = Record<string, string>;
/** Always-array shape used by photo galleries / admin UI. */
export type ImageOverridesMulti = Record<string, string[]>;
/** Hard cap on how many photos can be stored per slot. */
export const MAX_PHOTOS_PER_SLOT = 5;
export type SectionLayout = {
  sections?: string[];
  hidden?: string[];
};
export type LayoutOverrides = Record<string, SectionLayout>;

export type Multi = { ua?: string; ru?: string; en?: string };

export type Block =
  | { id: string; type: "hero-lite"; eyebrow?: Multi; title?: Multi; body?: Multi }
  | { id: string; type: "rich-text"; body?: Multi }
  | { id: string; type: "cta"; label?: Multi; href?: string; variant?: "primary" | "ghost"; external?: boolean }
  | { id: string; type: "image"; src?: string; alt?: string; caption?: Multi }
  | { id: string; type: "gallery"; items: { id: string; src: string; caption?: Multi }[] }
  | { id: string; type: "divider" };

export type PageDoc = {
  id: string;
  slug: string;
  title: Multi;
  blocks: Block[];
  createdAt: number;
  updatedAt: number;
};

export type PagesStore = { pages: PageDoc[] };

export type NavItem = {
  id: string;
  label: Multi;
  href: string;
  external?: boolean;
  locked?: boolean;
};

export type NavOverrides = {
  navbar?: NavItem[] | null;
  footer?: NavItem[] | null;
};

/** Merch catalog item.
 *  - `id` is the URL slug; for built-in items it is "flag" | "mug" | "patches"
 *    and merging uses translation defaults for any field left blank.
 *  - For custom items everything must be filled in CMS (otherwise the field
 *    is just empty).
 *  - `hidden:true` removes a default item from the catalog without deleting
 *    its translations. */
export type MerchItem = {
  id: string;
  isDefault?: boolean;
  hidden?: boolean;
  title?: Multi;
  price?: string;
  shortDesc?: Multi;
  longDesc?: Multi;
  /** Newline-separated bullets per locale. Empty = use defaults / no specs. */
  specs?: Multi;
  /** Comma-separated, e.g. "M, L, XL". Empty = use defaults / no sizes. */
  sizes?: string;
  /** Optional small badge override, e.g. "NEW". Free text per locale. */
  badge?: Multi;
  /** Optional code override (defaults to id.toUpperCase()). */
  code?: string;
};

export type MerchStore = { items: MerchItem[] };

/** Persisted shape of a single merch order under .merch-orders/<id>.json. */
export type MerchOrderStatus = "new" | "in_progress" | "done" | "cancelled";
export type MerchOrder = {
  id: string;
  createdAt: string;
  item: string;
  title: string;
  price: string;
  discord: string;
  callsign?: string;
  phone: string;
  city: string;
  qty: number;
  size?: string;
  notes?: string;
  status?: MerchOrderStatus;
  statusUpdatedAt?: string;
};

const mutexes = new Map<string, Promise<unknown>>();
async function withMutex<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = mutexes.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  mutexes.set(
    key,
    next.finally(() => {
      if (mutexes.get(key) === next) mutexes.delete(key);
    })
  );
  return next;
}

async function ensureDirs() {
  await fs.mkdir(CMS_DIR, { recursive: true });
  await fs.mkdir(IMAGES_DIR, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    console.error("cms:read_failed", file, e);
    return fallback;
  }
}

async function writeJsonAtomic(file: string, data: unknown) {
  await ensureDirs();
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, file);
}

// ── Text overrides ───────────────────────────────────────────────────────────

export async function readTextOverrides(): Promise<TextOverrides> {
  return readJson<TextOverrides>(TEXT_FILE, {});
}

export async function writeTextOverrides(o: TextOverrides): Promise<void> {
  await withMutex(TEXT_FILE, () => writeJsonAtomic(TEXT_FILE, o));
}

export async function setTextOverride(
  locale: string,
  dottedKey: string,
  value: string | null
): Promise<TextOverrides> {
  return withMutex(TEXT_FILE, async () => {
    const cur = await readTextOverrides();
    const lc = cur[locale] || {};
    if (value === null || value === "") {
      delete lc[dottedKey];
    } else {
      lc[dottedKey] = value;
    }
    cur[locale] = lc;
    await writeJsonAtomic(TEXT_FILE, cur);
    return cur;
  });
}

/** Apply dotted overrides on top of a deeply-nested messages object.
 *  e.g. "Nav.home" → messages.Nav.home = override.
 *  Mutates a clone of `base` and returns it.
 */
export function applyTextOverrides(
  base: Record<string, unknown>,
  flat: Record<string, string>
): Record<string, unknown> {
  const out = structuredClone(base);
  for (const [dotted, value] of Object.entries(flat)) {
    const parts = dotted.split(".");
    let cur: Record<string, unknown> = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
      cur = cur[k] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]] = value;
  }
  return out;
}

/** Walk the messages tree and emit dotted keys → string leaves. */
export function flattenMessages(
  m: unknown,
  prefix = ""
): Record<string, string> {
  const out: Record<string, string> = {};
  if (m === null || typeof m !== "object") return out;
  for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
    const dotted = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[dotted] = v;
    else if (v && typeof v === "object") Object.assign(out, flattenMessages(v, dotted));
  }
  return out;
}

// ── Image overrides ──────────────────────────────────────────────────────────

/** Normalize a raw entry (string or string[]) to a clean string[] (no duplicates). */
function toPhotoArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : [v];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of arr) {
    if (typeof url !== "string" || !url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out.slice(0, MAX_PHOTOS_PER_SLOT);
}

/** Legacy reader: returns the *first* photo URL per slot (string).
 *  ContentImage still uses this — a single photo per slot stays unchanged. */
export async function readImageOverrides(): Promise<ImageOverrides> {
  const raw = await readJson<ImageOverridesRaw>(IMAGES_FILE, {});
  const out: ImageOverrides = {};
  for (const [k, v] of Object.entries(raw)) {
    const arr = toPhotoArray(v);
    if (arr.length) out[k] = arr[0];
  }
  return out;
}

/** Multi-photo reader: always returns string[] (0..MAX). */
export async function readImageOverridesMulti(): Promise<ImageOverridesMulti> {
  const raw = await readJson<ImageOverridesRaw>(IMAGES_FILE, {});
  const out: ImageOverridesMulti = {};
  for (const [k, v] of Object.entries(raw)) {
    const arr = toPhotoArray(v);
    if (arr.length) out[k] = arr;
  }
  return out;
}

export async function writeImageOverridesMulti(o: ImageOverridesMulti): Promise<void> {
  await withMutex(IMAGES_FILE, () => writeJsonAtomic(IMAGES_FILE, o));
}

/** Legacy single-set/clear helper. Sets a slot's array to [publicUrl]
 *  (or removes the slot entirely if null). */
export async function setImageOverride(
  key: string,
  publicUrl: string | null
): Promise<ImageOverridesMulti> {
  return withMutex(IMAGES_FILE, async () => {
    const cur = await readImageOverridesMulti();
    if (publicUrl === null) delete cur[key];
    else cur[key] = [publicUrl];
    await writeJsonAtomic(IMAGES_FILE, cur);
    return cur;
  });
}

/** Append a photo to a slot. Returns the new array. Caps at MAX_PHOTOS_PER_SLOT
 *  and throws when full so the API can return 409. */
export async function pushImageOverride(
  key: string,
  publicUrl: string
): Promise<ImageOverridesMulti> {
  return withMutex(IMAGES_FILE, async () => {
    const cur = await readImageOverridesMulti();
    const arr = cur[key] ? [...cur[key]] : [];
    if (arr.includes(publicUrl)) {
      cur[key] = arr;
      await writeJsonAtomic(IMAGES_FILE, cur);
      return cur;
    }
    if (arr.length >= MAX_PHOTOS_PER_SLOT) {
      const err = new Error(
        `Slot "${key}" is full (max ${MAX_PHOTOS_PER_SLOT} photos)`
      );
      (err as Error & { code?: string }).code = "ESLOTFULL";
      throw err;
    }
    arr.push(publicUrl);
    cur[key] = arr;
    await writeJsonAtomic(IMAGES_FILE, cur);
    return cur;
  });
}

/** Remove the photo at `index` from `key`. If the slot becomes empty,
 *  drops the key entirely. */
export async function removeImageOverrideAt(
  key: string,
  index: number
): Promise<ImageOverridesMulti> {
  return withMutex(IMAGES_FILE, async () => {
    const cur = await readImageOverridesMulti();
    const arr = cur[key] ? [...cur[key]] : [];
    if (index < 0 || index >= arr.length) {
      await writeJsonAtomic(IMAGES_FILE, cur);
      return cur;
    }
    arr.splice(index, 1);
    if (arr.length === 0) delete cur[key];
    else cur[key] = arr;
    await writeJsonAtomic(IMAGES_FILE, cur);
    return cur;
  });
}

/** Reorder photos within a single slot. Index list must be a permutation
 *  of 0..n-1; otherwise the call no-ops. */
export async function reorderImageOverride(
  key: string,
  newOrder: number[]
): Promise<ImageOverridesMulti> {
  return withMutex(IMAGES_FILE, async () => {
    const cur = await readImageOverridesMulti();
    const arr = cur[key] ? [...cur[key]] : [];
    if (newOrder.length !== arr.length) {
      await writeJsonAtomic(IMAGES_FILE, cur);
      return cur;
    }
    const seen = new Set<number>();
    for (const i of newOrder) {
      if (i < 0 || i >= arr.length || seen.has(i)) {
        await writeJsonAtomic(IMAGES_FILE, cur);
        return cur;
      }
      seen.add(i);
    }
    cur[key] = newOrder.map((i) => arr[i]);
    await writeJsonAtomic(IMAGES_FILE, cur);
    return cur;
  });
}

export async function saveImageFile(
  key: string,
  filename: string,
  buf: Buffer
): Promise<string> {
  await ensureDirs();
  const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const ext = (path.extname(filename) || ".png").toLowerCase();
  const stamp = Date.now().toString(36);
  const finalName = `${safeKey}.${stamp}${ext}`;
  const target = path.join(IMAGES_DIR, finalName);
  await fs.writeFile(target, buf);
  return `/api/cms/images/${finalName}`;
}

// ── Layout overrides ─────────────────────────────────────────────────────────

export async function readLayoutOverrides(): Promise<LayoutOverrides> {
  return readJson<LayoutOverrides>(LAYOUT_FILE, {});
}

export async function writeLayoutOverrides(
  o: LayoutOverrides
): Promise<void> {
  await withMutex(LAYOUT_FILE, () => writeJsonAtomic(LAYOUT_FILE, o));
}

// ── Dynamic pages ────────────────────────────────────────────────────────────

export async function readPagesStore(): Promise<PagesStore> {
  return readJson<PagesStore>(PAGES_FILE, { pages: [] });
}

export async function writePagesStore(s: PagesStore): Promise<void> {
  await withMutex(PAGES_FILE, () => writeJsonAtomic(PAGES_FILE, s));
}

export async function findPageBySlug(slug: string): Promise<PageDoc | null> {
  const store = await readPagesStore();
  return store.pages.find((p) => p.slug === slug) || null;
}

export async function findPageById(id: string): Promise<PageDoc | null> {
  const store = await readPagesStore();
  return store.pages.find((p) => p.id === id) || null;
}

export async function upsertPage(page: PageDoc): Promise<PageDoc> {
  return withMutex(PAGES_FILE, async () => {
    const store = await readPagesStore();
    const now = Date.now();
    const idx = store.pages.findIndex((p) => p.id === page.id);
    const saved: PageDoc = {
      ...page,
      updatedAt: now,
      createdAt: idx === -1 ? now : store.pages[idx].createdAt,
    };
    if (idx === -1) store.pages.push(saved);
    else store.pages[idx] = saved;
    await writeJsonAtomic(PAGES_FILE, store);
    return saved;
  });
}

export async function deletePage(id: string): Promise<void> {
  return withMutex(PAGES_FILE, async () => {
    const store = await readPagesStore();
    store.pages = store.pages.filter((p) => p.id !== id);
    await writeJsonAtomic(PAGES_FILE, store);
  });
}

// ── Nav overrides ────────────────────────────────────────────────────────────

export async function readNavOverrides(): Promise<NavOverrides> {
  return readJson<NavOverrides>(NAV_FILE, {});
}

export async function writeNavOverrides(o: NavOverrides): Promise<void> {
  await withMutex(NAV_FILE, () => writeJsonAtomic(NAV_FILE, o));
}

// ── Merch catalog overrides ──────────────────────────────────────────────────

/** Built-in defaults — the 3 items whose translations live in messages files. */
export const DEFAULT_MERCH_IDS = ["flag", "mug", "patches"] as const;
export type DefaultMerchId = (typeof DEFAULT_MERCH_IDS)[number];

/** Slug validator: lowercase letters / digits / dashes, 1..40 chars. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
export function isValidMerchId(id: string): boolean {
  return SLUG_RE.test(id);
}

export async function readMerchStore(): Promise<MerchStore> {
  const s = await readJson<MerchStore>(MERCH_FILE, { items: [] });
  if (!Array.isArray(s.items)) return { items: [] };
  return s;
}

export async function writeMerchStore(s: MerchStore): Promise<void> {
  await withMutex(MERCH_FILE, () => writeJsonAtomic(MERCH_FILE, s));
}

export async function upsertMerchItem(item: MerchItem): Promise<MerchStore> {
  return withMutex(MERCH_FILE, async () => {
    const cur = await readMerchStore();
    const idx = cur.items.findIndex((i) => i.id === item.id);
    if (idx === -1) cur.items.push(item);
    else cur.items[idx] = { ...cur.items[idx], ...item };
    await writeJsonAtomic(MERCH_FILE, cur);
    return cur;
  });
}

export async function deleteMerchItem(id: string): Promise<MerchStore> {
  return withMutex(MERCH_FILE, async () => {
    const cur = await readMerchStore();
    const isDefault = (DEFAULT_MERCH_IDS as readonly string[]).includes(id);
    if (isDefault) {
      // For built-ins we can't actually remove translations; mark hidden.
      const idx = cur.items.findIndex((i) => i.id === id);
      const next: MerchItem = { id, isDefault: true, hidden: true };
      if (idx === -1) cur.items.push(next);
      else cur.items[idx] = { ...cur.items[idx], ...next };
    } else {
      cur.items = cur.items.filter((i) => i.id !== id);
    }
    await writeJsonAtomic(MERCH_FILE, cur);
    return cur;
  });
}

/** Convenience: returns set of currently-known merch ids (defaults + custom),
 *  excluding hidden defaults. Used to dynamically expand image-slot list. */
export async function listVisibleMerchIds(): Promise<string[]> {
  const store = await readMerchStore();
  const out = new Set<string>(DEFAULT_MERCH_IDS as readonly string[]);
  // Apply hides + add custom ids.
  for (const it of store.items) {
    if (it.hidden && (DEFAULT_MERCH_IDS as readonly string[]).includes(it.id)) {
      out.delete(it.id);
    }
    if (!(DEFAULT_MERCH_IDS as readonly string[]).includes(it.id) && !it.hidden) {
      out.add(it.id);
    }
  }
  return Array.from(out);
}

// ── Merch orders ─────────────────────────────────────────────────────────────

export const ORDERS_DIR =
  process.env.MERCH_STORE_DIR || path.join(process.cwd(), ".merch-orders");

async function ensureOrdersDir() {
  await fs.mkdir(ORDERS_DIR, { recursive: true });
}

/** Read all order JSONs in $ORDERS_DIR, newest-first. */
export async function readMerchOrders(): Promise<MerchOrder[]> {
  await ensureOrdersDir();
  let names: string[] = [];
  try {
    names = await fs.readdir(ORDERS_DIR);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("orders:readdir_failed", e);
    }
    return [];
  }
  const out: MerchOrder[] = [];
  for (const n of names) {
    if (!n.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(ORDERS_DIR, n), "utf-8");
      const parsed = JSON.parse(raw) as MerchOrder;
      if (parsed && typeof parsed.id === "string") {
        if (!parsed.status) parsed.status = "new";
        out.push(parsed);
      }
    } catch (e) {
      console.error("orders:read_failed", n, e);
    }
  }
  out.sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || "")
  );
  return out;
}

export async function readMerchOrder(id: string): Promise<MerchOrder | null> {
  if (!/^[a-zA-Z0-9_]+$/.test(id)) return null;
  await ensureOrdersDir();
  try {
    const raw = await fs.readFile(path.join(ORDERS_DIR, `${id}.json`), "utf-8");
    const parsed = JSON.parse(raw) as MerchOrder;
    if (!parsed.status) parsed.status = "new";
    return parsed;
  } catch {
    return null;
  }
}

export async function writeMerchOrder(order: MerchOrder): Promise<void> {
  await ensureOrdersDir();
  if (!/^[a-zA-Z0-9_]+$/.test(order.id)) {
    throw new Error(`bad order id: ${order.id}`);
  }
  const file = path.join(ORDERS_DIR, `${order.id}.json`);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(order, null, 2), "utf8");
  await fs.rename(tmp, file);
}

export async function setMerchOrderStatus(
  id: string,
  status: MerchOrderStatus
): Promise<MerchOrder | null> {
  const cur = await readMerchOrder(id);
  if (!cur) return null;
  cur.status = status;
  cur.statusUpdatedAt = new Date().toISOString();
  await writeMerchOrder(cur);
  return cur;
}

export async function deleteMerchOrder(id: string): Promise<boolean> {
  if (!/^[a-zA-Z0-9_]+$/.test(id)) return false;
  await ensureOrdersDir();
  try {
    await fs.unlink(path.join(ORDERS_DIR, `${id}.json`));
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw e;
  }
}
