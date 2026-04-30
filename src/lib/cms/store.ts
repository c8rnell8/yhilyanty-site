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
  "/home/ubuntu/yhilyanty-site/.cms-overrides";

export const IMAGES_DIR = path.join(CMS_DIR, "images");

export const TEXT_FILE = path.join(CMS_DIR, "text.json");
export const IMAGES_FILE = path.join(CMS_DIR, "images.json");
export const LAYOUT_FILE = path.join(CMS_DIR, "layout.json");
export const PAGES_FILE = path.join(CMS_DIR, "pages.json");
export const NAV_FILE = path.join(CMS_DIR, "nav.json");

export type TextOverrides = Record<string, Record<string, string>>;
export type ImageOverrides = Record<string, string>;
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

export async function readImageOverrides(): Promise<ImageOverrides> {
  return readJson<ImageOverrides>(IMAGES_FILE, {});
}

export async function writeImageOverrides(o: ImageOverrides): Promise<void> {
  await withMutex(IMAGES_FILE, () => writeJsonAtomic(IMAGES_FILE, o));
}

export async function setImageOverride(
  key: string,
  publicUrl: string | null
): Promise<ImageOverrides> {
  return withMutex(IMAGES_FILE, async () => {
    const cur = await readImageOverrides();
    if (publicUrl === null) delete cur[key];
    else cur[key] = publicUrl;
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
