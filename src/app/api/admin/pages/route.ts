import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { requireOwner } from "@/lib/cms/guard";
import {
  deletePage,
  findPageBySlug,
  readPagesStore,
  upsertPage,
  type PageDoc,
} from "@/lib/cms/store";

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function GET() {
  const deny = await requireOwner();
  if (deny) return deny;
  const store = await readPagesStore();
  return NextResponse.json(store);
}

export async function POST(req: Request) {
  const deny = await requireOwner(req);
  if (deny) return deny;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const b = body as Partial<PageDoc>;
  const slug = slugify(b.slug || "");
  if (!slug) {
    return NextResponse.json({ error: "Slug is required" }, { status: 400 });
  }
  const existing = await findPageBySlug(slug);
  if (existing) {
    return NextResponse.json({ error: "Slug already used" }, { status: 409 });
  }
  const page: PageDoc = {
    id: b.id || randomUUID(),
    slug,
    title: b.title || {},
    blocks: Array.isArray(b.blocks) ? b.blocks : [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const saved = await upsertPage(page);
  return NextResponse.json({ ok: true, page: saved });
}

export async function PUT(req: Request) {
  const deny = await requireOwner(req);
  if (deny) return deny;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const b = body as Partial<PageDoc>;
  if (!b.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const slug = slugify(b.slug || "");
  if (!slug) {
    return NextResponse.json({ error: "Slug is required" }, { status: 400 });
  }
  // Check slug collision with other pages
  const collision = await findPageBySlug(slug);
  if (collision && collision.id !== b.id) {
    return NextResponse.json({ error: "Slug already used" }, { status: 409 });
  }
  const saved = await upsertPage({
    id: b.id,
    slug,
    title: b.title || {},
    blocks: Array.isArray(b.blocks) ? b.blocks : [],
    createdAt: 0,
    updatedAt: 0,
  });
  return NextResponse.json({ ok: true, page: saved });
}

export async function DELETE(req: Request) {
  const deny = await requireOwner(req);
  if (deny) return deny;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deletePage(id);
  return NextResponse.json({ ok: true });
}
