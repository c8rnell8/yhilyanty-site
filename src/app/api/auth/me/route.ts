import { NextResponse } from "next/server";

import { getSession, isOwner } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ session: null, owner: false });
  }
  return NextResponse.json({
    session,
    owner: isOwner(session),
  });
}
