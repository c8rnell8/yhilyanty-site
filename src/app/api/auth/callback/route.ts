import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  STATE_COOKIE,
  getDiscordConfig,
  safeReturnTo,
  sealSession,
  type Session,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cfg = getDiscordConfig();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  if (!cfg.enabled || !code || !state || state !== expectedState) {
    const dest = new URL("/", cfg.baseUrl);
    dest.searchParams.set("auth", "failed");
    return NextResponse.redirect(dest);
  }

  const returnTo = safeReturnTo(decodeURIComponent(state.split(".")[1] || "/"));

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const dest = new URL(returnTo, cfg.baseUrl);
    dest.searchParams.set("auth", "token-failed");
    return NextResponse.redirect(dest);
  }

  const token = (await tokenRes.json()) as { access_token: string; token_type: string };

  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: { authorization: `${token.token_type} ${token.access_token}` },
  });

  if (!meRes.ok) {
    const dest = new URL(returnTo, cfg.baseUrl);
    dest.searchParams.set("auth", "me-failed");
    return NextResponse.redirect(dest);
  }

  const me = (await meRes.json()) as {
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
    email: string | null;
  };

  const session: Session = {
    id: me.id,
    username: me.username,
    globalName: me.global_name,
    avatar: me.avatar,
    email: me.email,
    iat: Math.floor(Date.now() / 1000),
  };

  const sealed = sealSession(session);
  if (!sealed) {
    const dest = new URL(returnTo, cfg.baseUrl);
    dest.searchParams.set("auth", "missing-config");
    return NextResponse.redirect(dest);
  }

  const dest = new URL(returnTo, cfg.baseUrl);
  dest.searchParams.set("auth", "ok");

  const res = NextResponse.redirect(dest);
  res.cookies.set(SESSION_COOKIE, sealed, {
    httpOnly: true,
    sameSite: "lax",
    secure: cfg.baseUrl.startsWith("https://"),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
