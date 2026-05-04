import { NextResponse } from "next/server";
import path from "node:path";

import { requireOwner } from "@/lib/cms/guard";
import {
  MAX_PHOTOS_PER_SLOT,
  pushImageOverride,
  readImageOverridesMulti,
  removeImageOverrideAt,
  reorderImageOverride,
  saveImageFile,
  setImageOverride,
} from "@/lib/cms/store";
import { listImageSlots } from "@/lib/cms/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

/** GET /api/admin/images
 *  Returns: { slots: [...], overrides: {key: string[]}, max: 5 }
 */
export async function GET() {
  const guard = await requireOwner();
  if (guard) return guard;
  const [slots, overrides] = await Promise.all([
    listImageSlots(),
    readImageOverridesMulti(),
  ]);
  return NextResponse.json({
    slots,
    overrides,
    max: MAX_PHOTOS_PER_SLOT,
  });
}

/** POST /api/admin/images  (multipart)
 *  Fields:
 *    key=<slot>            — slot identifier
 *    file=<image>          — uploaded file
 *    mode=append|replace   — default "append" (push photo, up to MAX);
 *                            "replace" wipes the slot and stores [photo].
 */
export async function POST(req: Request) {
  const guard = await requireOwner();
  if (guard) return guard;

  const ct = req.headers.get("content-type") || "";
  if (!ct.toLowerCase().includes("multipart/form-data"))
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 }
    );

  const form = await req.formData();
  const key = String(form.get("key") || "");
  const mode = String(form.get("mode") || "append");
  const file = form.get("file");

  // `pages.*` keys come from the page-editor for blocks inside user-created
  // pages. They are dynamic (page/block/gallery-item scoped) and never appear
  // in the static slot registry, so we accept any well-formed `pages.*` key
  // without looking it up. For those we only save the file and return the URL;
  // the page JSON holds the reference itself, not the image-overrides store.
  const isPageScoped = /^pages\.[a-zA-Z0-9_.-]+$/.test(key);
  if (!isPageScoped) {
    const slots = await listImageSlots();
    if (!slots.find((s) => s.key === key))
      return NextResponse.json(
        { error: `Unknown image slot: ${key}` },
        { status: 400 }
      );
  }
  if (!(file instanceof File))
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES} bytes)` },
      { status: 413 }
    );
  const ext = path.extname(file.name || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext))
    return NextResponse.json(
      { error: `Unsupported extension: ${ext}` },
      { status: 400 }
    );

  const buf = Buffer.from(await file.arrayBuffer());
  const url = await saveImageFile(key, file.name || `image${ext}`, buf);

  // Page-scoped uploads: the page JSON stores the URL, not the overrides
  // registry — so just return the URL and let the client wire it up.
  if (isPageScoped) {
    return NextResponse.json({ ok: true, key, url, photos: [url] });
  }

  let photos: string[];
  if (mode === "replace") {
    const all = await setImageOverride(key, url);
    photos = all[key] || [];
  } else {
    try {
      const all = await pushImageOverride(key, url);
      photos = all[key] || [];
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "ESLOTFULL")
        return NextResponse.json(
          { error: err.message, code: "ESLOTFULL" },
          { status: 409 }
        );
      throw e;
    }
  }
  return NextResponse.json({ ok: true, key, url, photos });
}

/** DELETE /api/admin/images?key=<slot>&index=<n>
 *    - With index → remove a single photo
 *    - Without index → revert the entire slot to default
 */
export async function DELETE(req: Request) {
  const guard = await requireOwner();
  if (guard) return guard;
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "";
  const idxRaw = url.searchParams.get("index");
  if (!key)
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  const slots = await listImageSlots();
  if (!slots.find((s) => s.key === key))
    return NextResponse.json(
      { error: `Unknown image slot: ${key}` },
      { status: 400 }
    );
  if (idxRaw !== null) {
    const idx = Number.parseInt(idxRaw, 10);
    if (!Number.isFinite(idx) || idx < 0)
      return NextResponse.json({ error: "Bad index" }, { status: 400 });
    const all = await removeImageOverrideAt(key, idx);
    return NextResponse.json({ ok: true, key, photos: all[key] || [] });
  }
  await setImageOverride(key, null);
  return NextResponse.json({ ok: true, key, photos: [] });
}

/** PATCH /api/admin/images   { key, order: number[] } — reorder photos in a slot. */
export async function PATCH(req: Request) {
  const guard = await requireOwner();
  if (guard) return guard;
  let body: { key?: string; order?: number[] };
  try {
    body = (await req.json()) as { key?: string; order?: number[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const key = body.key || "";
  const order = body.order;
  if (!key || !Array.isArray(order))
    return NextResponse.json(
      { error: "Required: key + order[]" },
      { status: 400 }
    );
  const slots = await listImageSlots();
  if (!slots.find((s) => s.key === key))
    return NextResponse.json(
      { error: `Unknown image slot: ${key}` },
      { status: 400 }
    );
  const all = await reorderImageOverride(key, order);
  return NextResponse.json({ ok: true, key, photos: all[key] || [] });
}
