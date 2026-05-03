import { NextResponse } from "next/server";

import { requireOwner } from "@/lib/cms/guard";
import {
  DEFAULT_MERCH_IDS,
  deleteMerchItem,
  isValidMerchId,
  type MerchItem,
  readMerchStore,
  upsertMerchItem,
} from "@/lib/cms/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeMulti(v: unknown): { ua?: string; ru?: string; en?: string } | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const out: { ua?: string; ru?: string; en?: string } = {};
  for (const lc of ["ua", "ru", "en"] as const) {
    const x = o[lc];
    if (typeof x === "string" && x.trim()) out[lc] = x.slice(0, 8000);
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeItem(b: Partial<MerchItem>): MerchItem | { error: string } {
  const id = (b.id || "").toString().trim().toLowerCase();
  if (!id) return { error: "id is required" };
  if (!isValidMerchId(id))
    return { error: "id must be lowercase letters/digits/dashes (1..40)" };
  const isDefault = (DEFAULT_MERCH_IDS as readonly string[]).includes(id);
  const next: MerchItem = { id, isDefault };
  if (typeof b.hidden === "boolean") next.hidden = b.hidden;
  const title = sanitizeMulti(b.title);
  if (title) next.title = title;
  if (typeof b.price === "string" && b.price.trim()) next.price = b.price.slice(0, 80);
  const shortDesc = sanitizeMulti(b.shortDesc);
  if (shortDesc) next.shortDesc = shortDesc;
  const longDesc = sanitizeMulti(b.longDesc);
  if (longDesc) next.longDesc = longDesc;
  const specs = sanitizeMulti(b.specs);
  if (specs) next.specs = specs;
  if (typeof b.sizes === "string" && b.sizes.trim()) next.sizes = b.sizes.slice(0, 200);
  const badge = sanitizeMulti(b.badge);
  if (badge) next.badge = badge;
  if (typeof b.code === "string" && b.code.trim()) next.code = b.code.slice(0, 40);
  return next;
}

export async function GET() {
  const deny = await requireOwner();
  if (deny) return deny;
  const store = await readMerchStore();
  return NextResponse.json({
    items: store.items,
    defaultIds: DEFAULT_MERCH_IDS,
  });
}

/** POST creates / updates an item by id (upsert). */
export async function POST(req: Request) {
  const deny = await requireOwner();
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as Partial<MerchItem> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const cleaned = sanitizeItem(body);
  if ("error" in cleaned) {
    return NextResponse.json({ error: cleaned.error }, { status: 400 });
  }
  const store = await upsertMerchItem(cleaned);
  return NextResponse.json({ ok: true, item: cleaned, items: store.items });
}

/** DELETE ?id=<slug> removes a custom item or hides a built-in. */
export async function DELETE(req: Request) {
  const deny = await requireOwner();
  if (deny) return deny;
  const url = new URL(req.url);
  const id = (url.searchParams.get("id") || "").toLowerCase();
  if (!id || !isValidMerchId(id))
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const store = await deleteMerchItem(id);
  return NextResponse.json({ ok: true, items: store.items });
}
