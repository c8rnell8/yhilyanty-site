import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

import { rejectCrossOrigin } from "@/lib/cms/guard";
import {
  isValidMerchId,
  listVisibleMerchIds,
  ORDER_UPLOADS_DIR,
  type MerchOrder,
  writeMerchOrder,
} from "@/lib/cms/store";
import { rateLimit } from "@/lib/rate-limit";

const MAX_ORDER_IMAGES = 3;
const MAX_IMAGE_B64 = 3 * 1024 * 1024; // ~2 MB raw per image

const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

/** Anyone on the internet can hit this endpoint, so don't trust the declared
 *  mime type - check the file really starts like that kind of image. */
function magicBytesMatch(buf: Buffer, mime: string): boolean {
  switch (mime) {
    case "image/png":
      return buf.length > 8 && buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    case "image/jpeg":
      return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case "image/gif":
      return buf.length > 6 && buf.subarray(0, 4).toString("latin1") === "GIF8";
    case "image/webp":
      return (
        buf.length > 12 &&
        buf.subarray(0, 4).toString("latin1") === "RIFF" &&
        buf.subarray(8, 12).toString("latin1") === "WEBP"
      );
    default:
      return false;
  }
}

export async function POST(req: Request) {
  const cross = rejectCrossOrigin(req);
  if (cross) return cross;

  const limited = rateLimit(req, "order", 5, 600);
  if (limited) return limited;

  // 3 photos base64 + form fields fit well under this; bigger bodies are abuse.
  const len = Number(req.headers.get("content-length") || 0);
  if (len > 12 * 1024 * 1024) {
    return NextResponse.json({ error: "Запит завеликий" }, { status: 413 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // captcha first
  const token = body.captchaToken;
  // The form falls back to hCaptcha's public test sitekey, so the server has
  // to fall back to the matching test secret or local orders never pass.
  const secret =
    process.env.HCAPTCHA_SECRET ||
    "0x0000000000000000000000000000000000000000";

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Подтвердите капчу!" }, { status: 400 });
  }

  try {
    const verify = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ response: token, secret }).toString(),
    });
    const verification = await verify.json();
    if (!verification.success) {
      return NextResponse.json({ error: "Капча не пройдена" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: "Ошибка проверки капчи" }, { status: 500 });
  }

  const itemKey = String(body.itemKey || "").toLowerCase();
  if (!isValidMerchId(itemKey)) return NextResponse.json({ error: "Товар не найден" }, { status: 400 });

  const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // optional photo attachments (custom print designs etc.)
  const savedImages: string[] = [];
  if (body.images !== undefined) {
    if (!Array.isArray(body.images) || body.images.length > MAX_ORDER_IMAGES) {
      return NextResponse.json({ error: "Занадто багато фото (max 3)" }, { status: 400 });
    }
    await fs.mkdir(ORDER_UPLOADS_DIR, { recursive: true });
    for (let i = 0; i < body.images.length; i++) {
      const img = body.images[i];
      const mime = String(img?.mimeType || "");
      const data = String(img?.data || "");
      const ext = MIME_EXT[mime];
      if (!ext || !data || data.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(data)) {
        return NextResponse.json({ error: "Невалідне фото" }, { status: 400 });
      }
      const buf = Buffer.from(data, "base64");
      if (!magicBytesMatch(buf, mime)) {
        return NextResponse.json({ error: "Невалідне фото" }, { status: 400 });
      }
      const name = `${orderId}.${i}${ext}`;
      await fs.writeFile(path.join(ORDER_UPLOADS_DIR, name), buf);
      savedImages.push(name);
    }
  }

  const order: MerchOrder = {
    id: orderId,
    createdAt: new Date().toISOString(),
    item: itemKey,
    title: String(body.itemTitle || "").slice(0, 200),
    price: String(body.itemPrice || "").slice(0, 50),
    discord: String(body.discord || "").trim().slice(0, 100),
    callsign: String(body.callsign || "").trim().slice(0, 50),
    phone: String(body.phone || "").trim().slice(0, 40),
    city: String(body.city || "").trim().slice(0, 200),
    qty: Math.max(1, Math.min(99, Math.floor(Number(body.qty)) || 1)),
    size: String(body.size || ""),
    notes: String(body.notes || "").slice(0, 1000),
    images: savedImages,
    status: "new",
  };

  await writeMerchOrder(order);
  return NextResponse.json({ ok: true, id: order.id }, { status: 201 });
}
