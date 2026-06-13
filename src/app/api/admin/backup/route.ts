import { NextResponse } from "next/server";

import { auditLog } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { buildBundle, restoreBundle } from "@/lib/backup";
import { requireRole } from "@/lib/cms/guard";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — download every CMS store as one JSON file. Uploaded image binaries
 *  aren't included (they live in .cms-overrides/images/ — copy that folder
 *  separately when moving servers, see MIGRATION.md). */
export async function GET() {
  const guard = await requireRole("owner");
  if (guard) return guard;

  const bundle = await buildBundle();
  const name = `yhilyanty-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** POST — restore a bundle made by GET. Overwrites the current stores. */
export async function POST(req: Request) {
  const guard = await requireRole("owner", req);
  if (guard) return guard;

  const limited = rateLimit(req, "backup-restore", 5, 600);
  if (limited) return limited;

  const len = Number(req.headers.get("content-length") || 0);
  if (len > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Backup file too large" }, { status: 413 });
  }

  let bundle: Record<string, unknown>;
  try {
    bundle = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let restored: string[];
  try {
    restored = await restoreBundle(bundle);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Bad backup" },
      { status: 400 },
    );
  }

  const session = await getSession();
  await auditLog(session, "backup.restore", restored.join(","));
  return NextResponse.json({ ok: true, restored });
}
