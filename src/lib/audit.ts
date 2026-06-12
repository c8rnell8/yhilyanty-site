import { promises as fs } from "node:fs";
import path from "node:path";

import { CMS_DIR } from "@/lib/cms/store";

/** Append-only action log: who changed what and when. One JSON per line.
 *  With several people holding admin/editor roles this is the only way to
 *  answer "хто це поміняв?". Never throws - logging must not break saves. */

export const AUDIT_FILE = path.join(CMS_DIR, "audit.jsonl");

export type AuditEntry = {
  ts: string;
  actorId: string;
  actorName: string;
  action: string;
  detail?: string;
};

export async function auditLog(
  actor: { id: string; username?: string; globalName?: string | null } | null,
  action: string,
  detail?: string,
): Promise<void> {
  try {
    await fs.mkdir(CMS_DIR, { recursive: true });
    const entry: AuditEntry = {
      ts: new Date().toISOString(),
      actorId: actor?.id || "anonymous",
      actorName: actor?.globalName || actor?.username || "",
      action,
      ...(detail ? { detail: detail.slice(0, 300) } : {}),
    };
    await fs.appendFile(AUDIT_FILE, JSON.stringify(entry) + "\n", "utf8");
  } catch {
    // best effort only
  }
}

export async function readAudit(limit = 300): Promise<AuditEntry[]> {
  try {
    const raw = await fs.readFile(AUDIT_FILE, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .map((l) => {
        try {
          return JSON.parse(l) as AuditEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is AuditEntry => e !== null)
      .reverse();
  } catch {
    return [];
  }
}
