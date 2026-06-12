import { NextResponse } from "next/server";

import { requireRole } from "@/lib/cms/guard";
import { readOrdersStore, setOrderStatus, type MerchOrder } from "@/lib/cms/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: MerchOrder["status"][] = ["new", "seen", "done", "cancelled"];

export async function GET() {
  const guard = await requireRole("admin");
  if (guard) return guard;
  return NextResponse.json(await readOrdersStore());
}

export async function PATCH(req: Request) {
  const guard = await requireRole("admin", req);
  if (guard) return guard;

  let body: { id?: unknown; status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const status = body.status as MerchOrder["status"];
  if (!id || !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Bad id or status" }, { status: 400 });
  }

  const store = await setOrderStatus(id, status);
  return NextResponse.json(store);
}
