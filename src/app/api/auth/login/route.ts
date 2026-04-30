import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { STATE_COOKIE, getDiscordConfig } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cfg = getDiscordConfig();
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") || "/";

  if (!cfg.enabled) {
    const dest = new URL(returnTo, cfg.baseUrl);
    dest.searchParams.set("auth", "missing-config");
    return NextResponse.redirect(dest);
  }

  const state = `${crypto.randomUUID()}.${encodeURIComponent(returnTo)}`;
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: cfg.baseUrl.startsWith("https://"),
    path: "/",
    maxAge: 60 * 10,
  });

  const authUrl = new URL("https://discord.com/oauth2/authorize");
  authUrl.searchParams.set("client_id", cfg.clientId);
  authUrl.searchParams.set("redirect_uri", cfg.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "identify email");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "none");

  return NextResponse.redirect(authUrl);
}
