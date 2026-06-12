import { NextResponse } from "next/server";

import { readAudit } from "@/lib/audit";
import { requireOwner } from "@/lib/cms/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireOwner();
  if (guard) return guard;
  return NextResponse.json({ entries: await readAudit(300) });
}
