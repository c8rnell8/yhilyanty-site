"use client";

import {
  CameraIcon,
  CircleNotchIcon,
  ClockCounterClockwiseIcon,
  DownloadSimpleIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react";
import { useMemo, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";
import type { AuditEntry } from "@/lib/audit";
import type { SnapshotInfo } from "@/lib/backup";

function fmtSize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function snapDate(name: string): string {
  const m = name.match(/snapshot-(.+)\.json/);
  if (!m) return name;
  const iso = m[1].replace(/-(\d\d)-(\d\d)\.(\d+Z)$/, ":$1:$2.$3");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? name : d.toLocaleString("uk-UA");
}

export function SystemPanel({
  initialAudit,
  initialSnapshots,
}: {
  initialAudit: AuditEntry[];
  initialSnapshots: SnapshotInfo[];
}) {
  const [entries, setEntries] = useState(initialAudit);
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      `${e.actorName} ${e.actorId} ${e.action} ${e.detail || ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [entries, query]);

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

  async function refreshSnapshots() {
    const res = await fetch("/api/admin/backup/snapshots", { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) setSnapshots(j.snapshots || []);
  }

  async function snapshotNow() {
    setBusy("snap");
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/backup/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg("Снімок створено.");
      refreshSnapshots();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function restoreSnapshot(name: string) {
    if (!window.confirm(`Відкотити сайт до знімка від ${snapDate(name)}? Поточні дані буде перезаписано.`)) return;
    setBusy(name);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/backup/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", name }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMsg(`Відновлено зі знімка: ${(j.restored || []).join(", ")}`);
      refreshAudit();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function deleteSnapshot(name: string) {
    if (!window.confirm("Видалити цей знімок?")) return;
    setBusy(name);
    try {
      const res = await fetch(`/api/admin/backup/snapshots?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) setSnapshots(j.snapshots || []);
    } finally {
      setBusy(null);
    }
  }

  async function restoreFile(file: File) {
    if (!window.confirm("Відновлення ПЕРЕЗАПИШЕ поточні дані файлом. Продовжити?")) return;
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
          Резервні копії, автоматичні щоденні знімки і журнал дій команди.
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

      {/* Manual backup / restore */}
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-5 flex flex-col gap-3">
          <h2 className="font-bold tracking-tight">Завантажити бекап</h2>
          <p className="text-sm text-[color:var(--muted-2)] flex-1">
            Один файл з усіма текстами, сторінками, меню, командою і замовленнями.
          </p>
          <a
            href="/api/admin/backup"
            download
            className="tactical-text inline-flex items-center justify-center gap-2 h-10 rounded-sm bg-[color:var(--accent)] text-black font-bold hover:bg-[color:var(--accent-hard)]"
          >
            <DownloadSimpleIcon className="size-4" weight="bold" />
            Завантажити файл
          </a>
        </div>

        <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-5 flex flex-col gap-3">
          <h2 className="font-bold tracking-tight">Відновити з файлу</h2>
          <p className="text-sm text-[color:var(--muted-2)] flex-1">
            Поверне сайт до стану з файлу бекапу. Спершу зроби свіжий бекап.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) restoreFile(f);
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
            Вибрати файл
          </button>
        </div>
      </div>

      {/* Server-side snapshots */}
      <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] overflow-hidden mb-10">
        <header className="flex items-center justify-between p-5 border-b border-[color:var(--border)] gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold tracking-tight">Знімки на сервері</h3>
            <p className="text-sm text-[color:var(--muted-2)]">
              Створюються автоматично раз на день. Зберігаються останні 30.
            </p>
          </div>
          <button
            type="button"
            onClick={snapshotNow}
            disabled={busy === "snap"}
            className="tactical-text inline-flex items-center gap-2 px-3 h-9 rounded-sm border border-[color:var(--accent)]/40 text-[color:var(--accent)] hover:bg-[color:var(--accent-soft)] disabled:opacity-50"
          >
            {busy === "snap" ? (
              <CircleNotchIcon className="size-4 animate-spin" weight="bold" />
            ) : (
              <CameraIcon className="size-4" weight="bold" />
            )}
            Зробити знімок
          </button>
        </header>
        {snapshots.length === 0 ? (
          <div className="p-6 text-center text-[color:var(--muted-2)] text-sm">
            Знімків ще немає — створяться після першої зміни на сайті.
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--border)] max-h-[300px] overflow-y-auto">
            {snapshots.map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-3 px-5 py-3 flex-wrap">
                <span className="font-mono text-xs">
                  {snapDate(s.name)}{" "}
                  <span className="text-[color:var(--muted)]">· {fmtSize(s.bytes)}</span>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => restoreSnapshot(s.name)}
                    disabled={busy === s.name}
                    className="tactical-text inline-flex items-center gap-1 px-3 h-8 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 disabled:opacity-50"
                  >
                    <ClockCounterClockwiseIcon className="size-3.5" weight="bold" />
                    Відкотити
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSnapshot(s.name)}
                    disabled={busy === s.name}
                    className="tactical-text inline-flex items-center gap-1 px-3 h-8 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-rose-300 hover:border-rose-500/40 disabled:opacity-50"
                  >
                    <TrashIcon className="size-3.5" weight="bold" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit journal */}
      <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] overflow-hidden">
        <header className="flex items-center justify-between p-5 border-b border-[color:var(--border)] gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold tracking-tight">Журнал дій</h3>
            <p className="text-sm text-[color:var(--muted-2)]">
              Хто і коли щось міняв. Показано {filtered.length} з {entries.length}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-3 h-9 rounded-sm border border-[color:var(--border-strong)] bg-black/30 focus-within:border-[color:var(--accent)]">
              <MagnifyingGlassIcon className="size-4 text-[color:var(--muted)]" weight="bold" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Пошук: ім'я, дія…"
                className="bg-transparent outline-none text-sm font-mono w-40"
              />
            </label>
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
            </button>
          </div>
        </header>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-[color:var(--muted-2)] text-sm">
            {entries.length === 0 ? "Поки що порожньо." : "Нічого не знайдено."}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={i} className="border-b border-[color:var(--border)] last:border-b-0">
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
