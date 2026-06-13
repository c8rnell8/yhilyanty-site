import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { requireRole } from "@/lib/cms/guard";
import {
  deleteMerchProduct,
  readMerchStore,
  upsertMerchProduct,
  type MerchProduct,
  type Multi,
} from "@/lib/cms/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PRODUCTS = 50;
const MAX_MEDIA = 5;

function cleanMulti(v: unknown): Multi {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: Multi = {};
  for (const lc of ["ua", "ru", "en"] as const) {
    if (typeof o[lc] === "string") out[lc] = (o[lc] as string).slice(0, 2000);
  }
  return out;
}

export async function GET() {
  const guard = await requireRole("admin");
  if (guard) return guard;
  return NextResponse.json(await readMerchStore());
}

/** POST — create or update a product. */
export async function POST(req: Request) {
  const guard = await requireRole("admin", req);
  if (guard) return guard;

  let body: Partial<MerchProduct>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const store = await readMerchStore();
  const isNew = !body.id;
  if (isNew && store.products.length >= MAX_PRODUCTS) {
    return NextResponse.json({ error: "Too many products" }, { status: 400 });
  }

  const media = Array.isArray(body.media)
    ? body.media
        .filter((m): m is string => typeof m === "string" && m.length > 0)
        .slice(0, MAX_MEDIA)
    : [];
  const sizes = Array.isArray(body.sizes)
    ? body.sizes
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim().slice(0, 20))
        .slice(0, 20)
    : [];

  const product: MerchProduct = {
    id: typeof body.id === "string" && body.id ? body.id : `m_${randomUUID().slice(0, 8)}`,
    title: cleanMulti(body.title),
    desc: cleanMulti(body.desc),
    price: String(body.price || "").slice(0, 50),
    sizes,
    media,
    createdAt:
      store.products.find((p) => p.id === body.id)?.createdAt || Date.now(),
  };

  const updated = await upsertMerchProduct(product);
  return NextResponse.json({ ok: true, product, store: updated });
}

/** DELETE ?id= — remove a product. */
export async function DELETE(req: Request) {
  const guard = await requireRole("admin", req);
  if (guard) return guard;
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const store = await deleteMerchProduct(id);
  return NextResponse.json({ ok: true, store });
}
