import { NextResponse } from "next/server";

import { getSession, isOwner } from "@/lib/auth";
import { getRole, roleAtLeast, type Role } from "@/lib/roles";

/** Block cross-site form/fetch posts: if the browser sent an Origin header,
 *  it has to match the host we're serving. Requests without Origin (the bot,
 *  curl) pass — they don't carry cookies, so CSRF doesn't apply to them. */
export function rejectCrossOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") {
    if (origin === "null") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
  }
  const host = (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    ""
  )
    .split(",")[0]
    .trim();
  try {
    if (host && new URL(origin).host === host) return null;
  } catch {
    // fall through to reject
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/** Owner gate for admin APIs. Pass the request on state-changing handlers
 *  (POST/PUT/PATCH/DELETE) to also get the cross-origin check. */
export async function requireOwner(req?: Request): Promise<NextResponse | null> {
  if (req) {
    const cross = rejectCrossOrigin(req);
    if (cross) return cross;
  }
  const s = await getSession();
  if (!isOwner(s))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

/** Role gate: lets through anyone whose role is at least `min`.
 *  Same contract as requireOwner — pass the request on writes. */
export async function requireRole(
  min: Role,
  req?: Request,
): Promise<NextResponse | null> {
  if (req) {
    const cross = rejectCrossOrigin(req);
    if (cross) return cross;
  }
  const s = await getSession();
  const role = await getRole(s);
  if (!roleAtLeast(role, min))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}
