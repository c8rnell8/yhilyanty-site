import { cookies } from "next/headers";

export const SESSION_COOKIE = "yhl_session";
export const STATE_COOKIE = "yhl_oauth_state";

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

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Session;
    if (typeof parsed?.id !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
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
