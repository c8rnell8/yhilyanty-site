import { NextResponse } from "next/server";

import { requireOwner } from "@/lib/cms/guard";
import {
  deleteMerchOrder,
  type MerchOrderStatus,
  readMerchOrders,
  setMerchOrderStatus,
} from "@/lib/cms/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUS: ReadonlySet<MerchOrderStatus> = new Set([
  "new",
  "in_progress",
  "done",
  "cancelled",
]);

export async function GET() {
  const deny = await requireOwner();
  if (deny) return deny;
  const orders = await readMerchOrders();
  return NextResponse.json({ orders });
}

/** PATCH { id, status } — change status of an order. */
export async function PATCH(req: Request) {
  const deny = await requireOwner();
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as
    | { id?: string; status?: string }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const id = body.id || "";
  const status = body.status || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!VALID_STATUS.has(status as MerchOrderStatus))
    return NextResponse.json({ error: "bad status" }, { status: 400 });
  const order = await setMerchOrderStatus(id, status as MerchOrderStatus);
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, order });
}

/** DELETE ?id=<id> — permanently remove an order file. */
export async function DELETE(req: Request) {
  const deny = await requireOwner();
  if (deny) return deny;
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = await deleteMerchOrder(id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
