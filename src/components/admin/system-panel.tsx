"use client";

import {
  CircleNotchIcon,
  ClockCounterClockwiseIcon,
  DownloadSimpleIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { Link } from "@/i18n/navigation";
import type { AuditEntry } from "@/lib/audit";

export function SystemPanel({ initialAudit }: { initialAudit: AuditEntry[] }) {
  const [entries, setEntries] = useState(initialAudit);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function restore(file: File) {
    if (
      !window.confirm(
        "Відновлення ПЕРЕЗАПИШЕ поточні тексти, сторінки, меню, команду і замовлення даними з файлу. Продовжити?",
      )
    )
      return;
    setBusy("restore");
    setErr(null);
    setMsg(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg(`Відновлено: ${(j.restored || []).join(", ")}`);
      refreshAudit();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function refreshAudit() {
    setBusy("audit");
    try {
      const res = await fetch("/api/admin/audit", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (res.ok) setEntries(j.entries || []);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-10 py-10">
      <div className="flex flex-col gap-2 mb-8">
        <Link
          href="/admin"
          className="tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)]"
        >
          ← АДМІН-ПАНЕЛЬ
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Система</h1>
        <p className="text-sm text-[color:var(--muted-2)] max-w-2xl">
          Резервна копія всього вмісту сайту і журнал дій команди.
        </p>
      </div>

      {err && (
        <div className="mb-6 px-4 py-3 rounded-sm border border-red-500/40 bg-red-500/10 text-red-300 text-sm">
          {err}
        </div>
      )}
      {msg && (
        <div className="mb-6 px-4 py-3 rounded-sm border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-sm">
          {msg}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 mb-10">
        <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-5 flex flex-col gap-3">
          <h2 className="font-bold tracking-tight">Зробити бекап</h2>
          <p className="text-sm text-[color:var(--muted-2)] flex-1">
            Один файл з усіма текстами, сторінками, меню, командою і
            замовленнями. Зберігай його час від часу в надійне місце.
          </p>
          <a
            href="/api/admin/backup"
            download
            className="tactical-text inline-flex items-center justify-center gap-2 h-10 rounded-sm bg-[color:var(--accent)] text-black font-bold hover:bg-[color:var(--accent-hard)]"
          >
            <DownloadSimpleIcon className="size-4" weight="bold" />
            Завантажити бекап
          </a>
        </div>

        <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-5 flex flex-col gap-3">
          <h2 className="font-bold tracking-tight">Відновити з бекапу</h2>
          <p className="text-sm text-[color:var(--muted-2)] flex-1">
            Повертає сайт до стану з файлу. Поточні дані буде перезаписано —
            спершу зроби свіжий бекап.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) restore(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy === "restore"}
            className="tactical-text inline-flex items-center justify-center gap-2 h-10 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 disabled:opacity-50"
          >
            {busy === "restore" ? (
              <CircleNotchIcon className="size-4 animate-spin" weight="bold" />
            ) : (
              <UploadSimpleIcon className="size-4" weight="bold" />
            )}
            Вибрати файл бекапу
          </button>
        </div>
      </div>

      <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] overflow-hidden">
        <header className="flex items-center justify-between p-5 border-b border-[color:var(--border)]">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold tracking-tight">Журнал дій</h3>
            <p className="text-sm text-[color:var(--muted-2)]">
              Хто і коли щось міняв на сайті. Останні {entries.length} записів.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshAudit}
            disabled={busy === "audit"}
            className="tactical-text inline-flex items-center gap-2 px-3 h-9 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] disabled:opacity-50"
          >
            {busy === "audit" ? (
              <CircleNotchIcon className="size-4 animate-spin" weight="bold" />
            ) : (
              <ClockCounterClockwiseIcon className="size-4" weight="bold" />
            )}
            Оновити
          </button>
        </header>
        {entries.length === 0 ? (
          <div className="p-8 text-center text-[color:var(--muted-2)] text-sm">
            Поки що порожньо — записи зʼявляться після перших змін.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {entries.map((e, i) => (
                  <tr
                    key={i}
                    className="border-b border-[color:var(--border)] last:border-b-0"
                  >
                    <td className="px-5 py-2.5 font-mono text-xs text-[color:var(--muted)] whitespace-nowrap">
                      {new Date(e.ts).toLocaleString("uk-UA")}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-xs whitespace-nowrap">
                      {e.actorName || e.actorId}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-xs text-[color:var(--muted-2)]">
                      {e.action}
                      {e.detail ? ` · ${e.detail}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
