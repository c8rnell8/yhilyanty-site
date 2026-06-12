import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

import { auditLog } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { requireRole } from "@/lib/cms/guard";
import {
  deleteOrder,
  ORDER_UPLOADS_DIR,
  readOrdersStore,
  setOrderArchived,
  setOrderStatus,
  type MerchOrder,
} from "@/lib/cms/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: MerchOrder["status"][] = ["new", "seen", "done", "cancelled"];

export async function GET() {
  const guard = await requireRole("admin");
  if (guard) return guard;
  return NextResponse.json(await readOrdersStore());
}

/** PATCH { id, status } changes the workflow state;
 *  PATCH { id, archived } moves an order in or out of the archive. */
export async function PATCH(req: Request) {
  const guard = await requireRole("admin", req);
  if (guard) return guard;

  let body: { id?: unknown; status?: unknown; archived?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  if (typeof body.archived === "boolean") {
    const store = await setOrderArchived(id, body.archived);
    return NextResponse.json(store);
  }

  const status = body.status as MerchOrder["status"];
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: "Bad status" }, { status: 400 });
  }
  const store = await setOrderStatus(id, status);
  return NextResponse.json(store);
}

/** DELETE ?id=... removes the order and its uploaded photos for good. */
export async function DELETE(req: Request) {
  const guard = await requireRole("admin", req);
  if (guard) return guard;

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const { store, removed } = await deleteOrder(id);
  if (removed?.images?.length) {
    for (const f of removed.images) {
      // belt and braces: only ever touch plain filenames inside the dir
      if (!/^[A-Za-z0-9_.-]+$/.test(f)) continue;
      await fs.unlink(path.join(ORDER_UPLOADS_DIR, f)).catch(() => {});
    }
  }
  const session = await getSession();
  await auditLog(session, "order.delete", id);
  return NextResponse.json(store);
}
