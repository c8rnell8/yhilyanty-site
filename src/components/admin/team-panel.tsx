"use client";

import {
  CircleNotchIcon,
  PlusIcon,
  ShieldStarIcon,
  TrashIcon,
  UserGearIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import type { TeamMember, TeamRole } from "@/lib/cms/store";

const ROLE_LABEL: Record<TeamRole, string> = {
  admin: "АДМІН",
  editor: "РЕДАКТОР",
};

const ROLE_HINT: Record<TeamRole, string> = {
  admin: "усі інструменти контенту + замовлення мерчу",
  editor: "тексти, зображення, сторінки, меню, AI",
};

const ROLE_CLASS: Record<TeamRole, string> = {
  admin: "bg-[color:var(--accent-soft)] text-[color:var(--accent)] border-[color:var(--accent)]/30",
  editor: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
};

export function TeamPanel({ initialMembers }: { initialMembers: TeamMember[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<TeamRole>("editor");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newId.trim(), name: newName, role: newRole }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMembers(j.members ?? []);
      setNewId("");
      setNewName("");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(id: string, name: string, role: TeamRole) {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, role }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMembers(j.members ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Забрати доступ у цього учасника?")) return;
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/team?id=${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMembers(j.members ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mx-auto max-w-[900px] px-4 sm:px-6 lg:px-10 py-10">
      <div className="flex flex-col gap-2 mb-8">
        <Link
          href="/admin"
          className="tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)]"
        >
          ← АДМІН-ПАНЕЛЬ
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Команда</h1>
        <p className="text-sm text-[color:var(--muted-2)] max-w-2xl">
          Видавай посади бійцям — вони зможуть заходити в адмінку через свій
          Discord. Адмін: {ROLE_HINT.admin}. Редактор: {ROLE_HINT.editor}.
          Посади видає тільки власник.
        </p>
      </div>

      {err && (
        <div className="mb-6 px-4 py-3 rounded-sm border border-red-500/40 bg-red-500/10 text-red-300 text-sm">
          {err}
        </div>
      )}

      <form
        onSubmit={add}
        className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-5 mb-8 flex flex-col gap-4"
      >
        <h2 className="font-bold tracking-tight inline-flex items-center gap-2">
          <PlusIcon className="size-4 text-[color:var(--accent)]" weight="bold" />
          Додати учасника
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="Discord ID (17–20 цифр)"
            required
            pattern="\d{17,20}"
            title="Discord ID — це число з 17–20 цифр. ПКМ по людині в Discord → «Копіювати ID»."
            className="h-11 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm font-mono focus:outline-none focus:border-[color:var(--accent)]"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Імʼя / позивний (для себе)"
            className="h-11 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm focus:outline-none focus:border-[color:var(--accent)]"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as TeamRole)}
            className="h-11 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm font-mono focus:outline-none focus:border-[color:var(--accent)]"
          >
            <option value="editor">Редактор</option>
            <option value="admin">Адмін</option>
          </select>
          <button
            type="submit"
            disabled={busy}
            className="h-11 px-5 rounded-sm bg-[color:var(--accent)] text-black font-mono uppercase text-sm tracking-[0.1em] hover:bg-[color:var(--accent-hard)] disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy ? (
              <CircleNotchIcon className="size-4 animate-spin" weight="bold" />
            ) : (
              <PlusIcon className="size-4" weight="bold" />
            )}
            Додати
          </button>
        </div>
        <p className="text-xs text-[color:var(--muted)]">
          Де взяти ID: Discord → Налаштування → Розширені → увімкни «Режим
          розробника», потім правий клік по людині → «Копіювати ID
          користувача».
        </p>
      </form>

      <div className="flex flex-col gap-3">
        {members.length === 0 && (
          <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-8 text-center text-[color:var(--muted-2)] flex flex-col items-center gap-3">
            <UserGearIcon className="size-8" weight="bold" />
            <span className="text-sm">
              Поки що в команді тільки ти. Додай перших помічників вище.
            </span>
          </div>
        )}
        {members.map((m) => (
          <div
            key={m.id}
            className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-4 flex items-center justify-between gap-4 flex-wrap"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 rounded-sm bg-[color:var(--accent-soft)] flex items-center justify-center shrink-0">
                <ShieldStarIcon className="size-5 text-[color:var(--accent)]" weight="bold" />
              </div>
              <div className="flex flex-col leading-tight min-w-0">
                <span className="font-bold truncate">{m.name || "Без імені"}</span>
                <span className="font-mono text-xs text-[color:var(--muted)] truncate">
                  {m.id}
                </span>
              </div>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-sm font-mono uppercase text-[10px] tracking-[0.16em] border ${ROLE_CLASS[m.role]}`}
                title={ROLE_HINT[m.role]}
              >
                {ROLE_LABEL[m.role]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {busyId === m.id ? (
                <CircleNotchIcon className="size-4 animate-spin text-[color:var(--muted-2)]" weight="bold" />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      changeRole(m.id, m.name, m.role === "admin" ? "editor" : "admin")
                    }
                    className="tactical-text inline-flex items-center gap-1 px-3 h-8 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40"
                  >
                    {m.role === "admin" ? "→ редактор" : "→ адмін"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    className="tactical-text inline-flex items-center gap-1 px-3 h-8 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-rose-300 hover:border-rose-500/40"
                  >
                    <TrashIcon className="size-3.5" weight="bold" />
                    Прибрати
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
