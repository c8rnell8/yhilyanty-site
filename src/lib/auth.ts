import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "yhl_session";
export const STATE_COOKIE = "yhl_oauth_state";

/** Sessions older than this are rejected even if the cookie is still around. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type Session = {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  email: string | null;
  iat: number;
};

export function getDiscordConfig() {
  const clientId = process.env.DISCORD_CLIENT_ID || "";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || "";
  const baseUrl = process.env.SITE_URL || "http://localhost:3000";
  return {
    clientId,
    clientSecret,
    baseUrl,
    redirectUri: `${baseUrl}/api/auth/callback`,
    enabled: Boolean(clientId && clientSecret),
  };
}

// Session cookies are signed so nobody can hand-craft one with someone
// else's Discord id. SESSION_SECRET is preferred; the OAuth client secret
// works as a fallback so existing deployments don't need a new env var.
function sessionSecret(): string | null {
  return process.env.SESSION_SECRET || process.env.DISCORD_CLIENT_SECRET || null;
}

/** Serialize and sign a session for the cookie: v1.<payload>.<mac>. */
export function sealSession(s: Session): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  const mac = createHmac("sha256", secret).update(payload).digest("base64url");
  return `v1.${payload}.${mac}`;
}

/** Verify and parse a cookie produced by sealSession. */
export function openSession(raw: string): Session | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, payload, mac] = parts;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let given: Buffer;
  try {
    given = Buffer.from(mac, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Session;
    if (typeof parsed?.id !== "string" || typeof parsed?.iat !== "number") {
      return null;
    }
    if (Math.floor(Date.now() / 1000) - parsed.iat > SESSION_MAX_AGE) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return openSession(raw);
}

export function isOwner(session: Session | null): boolean {
  if (!session) return false;
  const owner = process.env.OWNER_DISCORD_ID;
  if (!owner) return false;
  return session.id === owner;
}

export function avatarUrl(s: Session): string | null {
  if (!s.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${s.id}/${s.avatar}.png?size=128`;
}

/** Keep returnTo on this site: only allow local paths like "/ua/admin". */
export function safeReturnTo(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/";
  }
  return raw;
}
