import { NextResponse } from "next/server";
import { rejectCrossOrigin } from "@/lib/cms/guard";
import { isValidMerchId, listVisibleMerchIds, type MerchOrder, writeMerchOrder } from "@/lib/cms/store";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const cross = rejectCrossOrigin(req);
  if (cross) return cross;

  const limited = rateLimit(req, "order", 5, 600);
  if (limited) return limited;

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

  const order: MerchOrder = {
    id: `ord_${Date.now()}`,
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
    status: "new",
  };

  await writeMerchOrder(order);
  return NextResponse.json({ ok: true, id: order.id }, { status: 201 });
}
