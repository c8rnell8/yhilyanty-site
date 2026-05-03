import { NextResponse } from "next/server";

import {
  isValidMerchId,
  listVisibleMerchIds,
  type MerchOrder,
  writeMerchOrder,
} from "@/lib/cms/store";

type Body = {
  itemKey: string;
  itemTitle: string;
  itemPrice: string;
  discord: string;
  callsign: string;
  phone: string;
  city: string;
  qty: number;
  size: string;
  notes: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const itemKey = (body.itemKey || "").toString().toLowerCase();
  if (!isValidMerchId(itemKey)) {
    return NextResponse.json({ error: "Unknown item" }, { status: 400 });
  }
  const knownIds = await listVisibleMerchIds();
  if (!knownIds.includes(itemKey)) {
    return NextResponse.json({ error: "Unknown item" }, { status: 400 });
  }
  if (!body.discord?.trim() || body.discord.length > 100) {
    return NextResponse.json({ error: "Discord required" }, { status: 400 });
  }
  if (!body.phone?.trim() || body.phone.length > 40) {
    return NextResponse.json({ error: "Phone required" }, { status: 400 });
  }
  if (!body.city?.trim() || body.city.length > 200) {
    return NextResponse.json({ error: "City required" }, { status: 400 });
  }
  if (!Number.isFinite(body.qty) || body.qty < 1 || body.qty > 100) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
  }

  const order: MerchOrder = {
    id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    item: itemKey,
    title: body.itemTitle?.slice(0, 200) || "",
    price: body.itemPrice?.slice(0, 50) || "",
    discord: body.discord.trim().slice(0, 100),
    callsign: body.callsign?.trim().slice(0, 50) || "",
    phone: body.phone.trim().slice(0, 40),
    city: body.city.trim().slice(0, 200),
    qty: Math.floor(body.qty),
    size: body.size?.slice(0, 50) || "",
    notes: body.notes?.slice(0, 1000) || "",
    status: "new",
  };

  try {
    await writeMerchOrder(order);
  } catch (e) {
    console.error("merch:write_failed", e);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }

  // Optional Discord webhook
  const webhookUrl = process.env.MERCH_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "Ухилянти / Merch",
          content: `**Нове замовлення мерчу** \`${order.id}\``,
          embeds: [
            {
              title: `${order.title} — ${order.price}`,
              fields: [
                { name: "Discord", value: order.discord, inline: true },
                { name: "Телефон", value: order.phone, inline: true },
                { name: "Кількість", value: String(order.qty), inline: true },
                { name: "Розмір", value: order.size || "—", inline: true },
                { name: "Позивний", value: order.callsign || "—", inline: true },
                { name: "Місто/НП", value: order.city, inline: false },
                { name: "Нотатки", value: order.notes || "—", inline: false },
              ],
              color: 0xfbbf24,
            },
          ],
        }),
      });
    } catch (e) {
      console.error("merch:webhook_failed", e);
    }
  }

  return NextResponse.json({ ok: true, id: order.id }, { status: 201 });
}
