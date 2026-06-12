import { NextResponse } from "next/server";

import { SESSION_COOKIE, getDiscordConfig, safeReturnTo } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cfg = getDiscordConfig();
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const dest = new URL(returnTo, cfg.baseUrl);

  const res = NextResponse.redirect(dest);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
