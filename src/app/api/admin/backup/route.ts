import { NextResponse } from "next/server";

import { auditLog } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { requireOwner } from "@/lib/cms/guard";
import { rateLimit } from "@/lib/rate-limit";
import {
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KIND = "yhilyanty-backup";

/** GET — download every CMS store as one JSON file. Uploaded image binaries
 *  aren't included (they live in .cms-overrides/images/ — copy that folder
 *  separately when moving servers, see MIGRATION.md). */
export async function GET() {
  const guard = await requireOwner();
  if (guard) return guard;

  const bundle = {
    kind: KIND,
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

  const name = `yhilyanty-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

function isObj(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/** POST — restore a bundle made by GET. Overwrites the current stores. */
export async function POST(req: Request) {
  const guard = await requireOwner(req);
  if (guard) return guard;

  const limited = rateLimit(req, "backup-restore", 5, 600);
  if (limited) return limited;

  const len = Number(req.headers.get("content-length") || 0);
  if (len > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Backup file too large" }, { status: 413 });
  }

  let bundle: Record<string, unknown>;
  try {
    bundle = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (bundle.kind !== KIND || bundle.version !== 1) {
    return NextResponse.json(
      { error: "Це не файл бекапу цього сайту." },
      { status: 400 },
    );
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

  const session = await getSession();
  await auditLog(session, "backup.restore", restored.join(","));

  return NextResponse.json({ ok: true, restored });
}
