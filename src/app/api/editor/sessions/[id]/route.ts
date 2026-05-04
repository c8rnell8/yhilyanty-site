import { NextResponse } from "next/server";

import { readSession } from "@/lib/editor/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const s = await readSession(id);
  if (!s)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Strip large internal fields not needed by clients.
  return NextResponse.json({
    id: s.id,
    status: s.status,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    source: s.source,
    output: s.output,
    renderGen: s.renderGen || 0,
    error: s.error,
    ops: s.ops,
    origin: {
      discordUsername: s.origin.discordUsername,
    },
  });
}
