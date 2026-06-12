"use client";

import { useEffect, useState } from "react";

import type { Session } from "@/lib/auth";
import type { Role } from "@/lib/roles";

type MeResponse = { session: Session | null; owner: boolean; role: Role | null };

export function useClientSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [owner, setOwner] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MeResponse | null) => {
        if (!alive || !data) return;
        setSession(data.session);
        setOwner(data.owner);
        setRole(data.role ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { session, owner, role, loading };
}

export function discordDisplayName(session: Session | null): string {
  if (!session) return "";
  return session.globalName || session.username || "";
}
