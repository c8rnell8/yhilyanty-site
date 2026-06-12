import { NextResponse } from "next/server";
import { isValidMerchId, listVisibleMerchIds, type MerchOrder, writeMerchOrder } from "@/lib/cms/store";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // captcha first
  const token = body.captchaToken;
  const secret = process.env.HCAPTCHA_SECRET;

  if (!token) {
    return NextResponse.json({ error: "Подтвердите капчу!" }, { status: 400 });
  }

  try {
    const verify = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `response=${token}&secret=${secret}`,
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
    qty: Number(body.qty) || 1,
    size: String(body.size || ""),
    notes: String(body.notes || "").slice(0, 1000),
    status: "new",
  };

  await writeMerchOrder(order);
  return NextResponse.json({ ok: true, id: order.id }, { status: 201 });
}
