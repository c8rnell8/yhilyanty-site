import { NextResponse } from "next/server";
import {
  isValidMerchId,
  listVisibleMerchIds,
  type MerchOrder,
  writeMerchOrder,
} from "@/lib/cms/store";

export async function POST(req: Request) {
  let body: any; // Используем any временно, чтобы избежать конфликтов типов Next.js
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 1. Проверка капчи
  const token = body.captchaToken;
  if (!token) {
    return NextResponse.json({ error: "Captcha required" }, { status: 400 });
  }

  try {
    const verify = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `response=${token}&secret=${process.env.HCAPTCHA_SECRET}`,
    });
    const res = await verify.json();
    if (!res.success) {
      return NextResponse.json({ error: "Invalid captcha" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: "Captcha error" }, { status: 500 });
  }

  // 2. Валидация данных заказа
  const itemKey = (body.itemKey || "").toString().toLowerCase();
  if (!isValidMerchId(itemKey)) return NextResponse.json({ error: "Item error" }, { status: 400 });

  const order: MerchOrder = {
    id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    item: itemKey,
    title: String(body.itemTitle || "").slice(0, 200),
    price: String(body.itemPrice || "").slice(0, 50),
    discord: String(body.discord || "").trim().slice(0, 100),
    callsign: String(body.callsign || "").trim().slice(0, 50),
    phone: String(body.phone || "").trim().slice(0, 40),
    city: String(body.city || "").trim().slice(0, 200),
    qty: Math.max(1, Math.min(100, Number(body.qty) || 1)),
    size: String(body.size || "").slice(0, 50),
    notes: String(body.notes || "").slice(0, 1000),
    status: "new",
  };

  await writeMerchOrder(order);
  
  // Вебхук можно добавить сюда позже, главное — чтобы сайт заработал.
  return NextResponse.json({ ok: true, id: order.id }, { status: 201 });
}
