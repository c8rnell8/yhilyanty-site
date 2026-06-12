"use client";

import { useEffect, useState } from "react";

import type { Session } from "@/lib/auth";

type MeResponse = { session: Session | null; owner: boolean };

export function useClientSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [owner, setOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MeResponse | null) => {
        if (!alive || !data) return;
        setSession(data.session);
        setOwner(data.owner);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { session, owner, loading };
}

export function discordDisplayName(session: Session | null): string {
  if (!session) return "";
  return session.globalName || session.username || "";
}
