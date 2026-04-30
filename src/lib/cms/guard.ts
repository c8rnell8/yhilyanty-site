import { NextResponse } from "next/server";

import { getSession, isOwner } from "@/lib/auth";

export async function requireOwner(): Promise<NextResponse | null> {
  const s = await getSession();
  if (!isOwner(s))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}
