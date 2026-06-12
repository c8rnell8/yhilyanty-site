import { NextResponse } from "next/server";
import path from "node:path";

import { requireRole } from "@/lib/cms/guard";
import {
  readImageOverrides,
  saveImageFile,
  setImageOverride,
} from "@/lib/cms/store";
import { IMAGE_SLOTS } from "@/lib/cms/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

/** GET /api/admin/images
 *  Returns: { slots: [...], overrides: {key: url} }
 */
export async function GET() {
  const guard = await requireRole("editor");
  if (guard) return guard;
  const overrides = await readImageOverrides();
  return NextResponse.json({ slots: IMAGE_SLOTS, overrides });
}

/** POST /api/admin/images  (multipart)
 *  Fields: key=<slot>, file=<image>
 */
export async function POST(req: Request) {
  const guard = await requireRole("editor", req);
  if (guard) return guard;

  const ct = req.headers.get("content-type") || "";
  if (!ct.toLowerCase().includes("multipart/form-data"))
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 }
    );

  const form = await req.formData();
  const key = String(form.get("key") || "");
  const file = form.get("file");
  // Either a fixed site slot, or a block-scoped key from the page editor
  // (pages.<pageId>.<blockId>[.<itemId>]).
  const isSlot = Boolean(IMAGE_SLOTS.find((s) => s.key === key));
  const isPageKey = /^pages\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)?$/.test(key);
  if (!isSlot && !isPageKey)
    return NextResponse.json(
      { error: `Unknown image slot: ${key}` },
      { status: 400 }
    );
  if (!(file instanceof File))
    return NextResponse.json(
      { error: "Missing file" },
      { status: 400 }
    );
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
  // Slot overrides live in images.json; page-editor images are referenced
  // from the page itself, so saving the file is enough.
  if (isSlot) await setImageOverride(key, url);
  return NextResponse.json({ ok: true, key, url });
}

/** DELETE /api/admin/images?key=<slot>  — revert to default */
export async function DELETE(req: Request) {
  const guard = await requireRole("editor", req);
  if (guard) return guard;
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "";
  if (!key)
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  await setImageOverride(key, null);
  return NextResponse.json({ ok: true, key });
}
