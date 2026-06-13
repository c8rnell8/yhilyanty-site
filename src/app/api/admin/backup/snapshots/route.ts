import { NextResponse } from "next/server";

import { auditLog } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import {
  createSnapshot,
  deleteSnapshot,
  listSnapshots,
  readSnapshot,
  restoreBundle,
} from "@/lib/backup";
import { requireRole } from "@/lib/cms/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — list auto/manual snapshots kept on the server. */
export async function GET() {
  const guard = await requireRole("owner");
  if (guard) return guard;
  return NextResponse.json({ snapshots: await listSnapshots() });
}

/** POST { action: "create" } — snapshot now.
 *  POST { action: "restore", name } — roll back to a snapshot.
 *  DELETE handled below. */
export async function POST(req: Request) {
  const guard = await requireRole("owner", req);
  if (guard) return guard;
  const session = await getSession();

  let body: { action?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "create") {
    const snap = await createSnapshot();
    await auditLog(session, "backup.snapshot", snap.name);
    return NextResponse.json({ ok: true, snapshot: snap });
  }

  if (body.action === "restore") {
    const name = typeof body.name === "string" ? body.name : "";
    const raw = await readSnapshot(name);
    if (!raw) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    let restored: string[];
    try {
      restored = await restoreBundle(JSON.parse(raw));
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Bad snapshot" },
        { status: 400 },
      );
    }
    await auditLog(session, "backup.restore-snapshot", name);
    return NextResponse.json({ ok: true, restored });
  }

  return NextResponse.json({ error: "Bad action" }, { status: 400 });
}

export async function DELETE(req: Request) {
  const guard = await requireRole("owner", req);
  if (guard) return guard;
  const name = new URL(req.url).searchParams.get("name") || "";
  await deleteSnapshot(name);
  const session = await getSession();
  await auditLog(session, "backup.snapshot-delete", name);
  return NextResponse.json({ ok: true, snapshots: await listSnapshots() });
}
