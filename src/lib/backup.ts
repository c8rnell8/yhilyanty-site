import { promises as fs } from "node:fs";
import path from "node:path";

import {
  CMS_DIR,
  readImageOverrides,
  readLayoutOverrides,
  readNavOverrides,
  readOrdersStore,
  readPagesStore,
  readTeamStore,
  readTextOverrides,
  writeImageOverrides,
  writeLayoutOverrides,
  writeNavOverrides,
  writeOrdersStore,
  writePagesStore,
  writeTeamStore,
  writeTextOverrides,
} from "@/lib/cms/store";

export const BACKUPS_DIR = path.join(CMS_DIR, "backups");
export const BACKUP_KIND = "yhilyanty-backup";
const KEEP_SNAPSHOTS = 30; // ~a month of daily auto-snapshots
const SNAP_RE = /^snapshot-[0-9TZ:.-]+\.json$/;

export type Bundle = {
  kind: string;
  version: number;
  exportedAt: string;
  texts: unknown;
  images: unknown;
  layout: unknown;
  pages: unknown;
  nav: unknown;
  team: unknown;
  orders: unknown;
};

/** Snapshot of every CMS store. Image binaries live on disk separately
 *  (.cms-overrides/images, /media) — copy those folders when migrating. */
export async function buildBundle(): Promise<Bundle> {
  return {
    kind: BACKUP_KIND,
    version: 1,
    exportedAt: new Date().toISOString(),
    texts: await readTextOverrides(),
    images: await readImageOverrides(),
    layout: await readLayoutOverrides(),
    pages: await readPagesStore(),
    nav: await readNavOverrides(),
    team: await readTeamStore(),
    orders: await readOrdersStore(),
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/** Apply a bundle to the live stores. Returns which sections were restored. */
export async function restoreBundle(bundle: Record<string, unknown>): Promise<string[]> {
  if (bundle.kind !== BACKUP_KIND || bundle.version !== 1) {
    throw new Error("Це не файл бекапу цього сайту.");
  }
  const restored: string[] = [];
  if (isObj(bundle.texts)) {
    await writeTextOverrides(bundle.texts as never);
    restored.push("texts");
  }
  if (isObj(bundle.images)) {
    await writeImageOverrides(bundle.images as never);
    restored.push("images");
  }
  if (isObj(bundle.layout)) {
    await writeLayoutOverrides(bundle.layout as never);
    restored.push("layout");
  }
  if (isObj(bundle.pages) && Array.isArray((bundle.pages as { pages?: unknown }).pages)) {
    await writePagesStore(bundle.pages as never);
    restored.push("pages");
  }
  if (isObj(bundle.nav)) {
    await writeNavOverrides(bundle.nav as never);
    restored.push("nav");
  }
  if (isObj(bundle.team) && Array.isArray((bundle.team as { members?: unknown }).members)) {
    await writeTeamStore(bundle.team as never);
    restored.push("team");
  }
  if (isObj(bundle.orders) && Array.isArray((bundle.orders as { orders?: unknown }).orders)) {
    await writeOrdersStore(bundle.orders as never);
    restored.push("orders");
  }
  return restored;
}

export type SnapshotInfo = { name: string; bytes: number; mtime: number };

export async function listSnapshots(): Promise<SnapshotInfo[]> {
  await fs.mkdir(BACKUPS_DIR, { recursive: true });
  const names = await fs.readdir(BACKUPS_DIR);
  const out: SnapshotInfo[] = [];
  for (const name of names) {
    if (!SNAP_RE.test(name)) continue;
    const stat = await fs.stat(path.join(BACKUPS_DIR, name)).catch(() => null);
    if (stat?.isFile()) out.push({ name, bytes: stat.size, mtime: stat.mtimeMs });
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}

export async function createSnapshot(): Promise<SnapshotInfo> {
  await fs.mkdir(BACKUPS_DIR, { recursive: true });
  const bundle = await buildBundle();
  const name = `snapshot-${bundle.exportedAt.replace(/:/g, "-")}.json`;
  await fs.writeFile(path.join(BACKUPS_DIR, name), JSON.stringify(bundle), "utf8");
  await pruneSnapshots();
  const stat = await fs.stat(path.join(BACKUPS_DIR, name));
  return { name, bytes: stat.size, mtime: stat.mtimeMs };
}

async function pruneSnapshots(): Promise<void> {
  const snaps = await listSnapshots();
  for (const old of snaps.slice(KEEP_SNAPSHOTS)) {
    await fs.unlink(path.join(BACKUPS_DIR, old.name)).catch(() => {});
  }
}

export async function readSnapshot(name: string): Promise<string | null> {
  if (!SNAP_RE.test(name)) return null;
  return fs.readFile(path.join(BACKUPS_DIR, name), "utf8").catch(() => null);
}

export async function deleteSnapshot(name: string): Promise<void> {
  if (!SNAP_RE.test(name)) return;
  await fs.unlink(path.join(BACKUPS_DIR, name)).catch(() => {});
}

/** Make at most one automatic snapshot per calendar day. Called opportunistically
 *  whenever an admin saves something, so backups happen without any cron. */
let lastAutoCheck = 0;
export async function maybeAutoSnapshot(): Promise<void> {
  const now = Date.now();
  // Don't hit the disk on every single write — at most once an hour per process.
  if (now - lastAutoCheck < 60 * 60 * 1000) return;
  lastAutoCheck = now;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const snaps = await listSnapshots();
    const haveToday = snaps.some((s) => s.name.includes(today));
    if (!haveToday) await createSnapshot();
  } catch {
    // best effort
  }
}
