"use client";

import { useEffect, useState } from "react";

export type ClientSession = {
  id: string;
  username: string;
  globalName: string | null;
};

let cache: { session: ClientSession | null; owner: boolean } | undefined;
let pending: Promise<typeof cache> | undefined;

export function useClientSession() {
  const [data, setData] = useState<typeof cache | undefined>(cache);
  useEffect(() => {
    if (data !== undefined) return;
    if (!pending) {
      pending = fetch("/api/auth/me", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          cache = { session: j.session ?? null, owner: !!j.owner };
          return cache;
        })
        .catch(() => {
          cache = { session: null, owner: false };
          return cache;
        });
    }
    pending.then((v) => setData(v));
  }, [data]);
  return data ?? { session: null, owner: false };
}

export function discordDisplayName(s: ClientSession | null | undefined): string | null {
  if (!s) return null;
  return (s.globalName || s.username || "").trim() || null;
}
