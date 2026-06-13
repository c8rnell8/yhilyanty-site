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

const STR = {
  ua: {
    back: "← АДМІН-ПАНЕЛЬ",
    title: "Команда",
    roleAdmin: "АДМІН",
    roleEditor: "РЕДАКТОР",
    hintAdmin: "усі інструменти контенту + замовлення мерчу",
    hintEditor: "тексти, зображення, сторінки, меню, AI",
    subtitle: (a: string, e: string) =>
      `Видавай посади бійцям — вони зможуть заходити в адмінку через свій Discord. Адмін: ${a}. Редактор: ${e}. Посади видає тільки власник.`,
    add: "Додати учасника",
    idPlaceholder: "Discord ID (17–20 цифр)",
    idTitle: "Discord ID — це число з 17–20 цифр. ПКМ по людині в Discord → «Копіювати ID».",
    namePlaceholder: "Імʼя / позивний (для себе)",
    optEditor: "Редактор",
    optAdmin: "Адмін",
    addBtn: "Додати",
    idHelp: "Де взяти ID: Discord → Налаштування → Розширені → увімкни «Режим розробника», потім правий клік по людині → «Копіювати ID користувача».",
    emptyTeam: "Поки що в команді тільки ти. Додай перших помічників вище.",
    noName: "Без імені",
    toEditor: "→ редактор",
    toAdmin: "→ адмін",
    removeBtn: "Прибрати",
    removeConfirm: "Забрати доступ у цього учасника?",
  },
  ru: {
    back: "← АДМИН-ПАНЕЛЬ",
    title: "Команда",
    roleAdmin: "АДМИН",
    roleEditor: "РЕДАКТОР",
    hintAdmin: "все инструменты контента + заказы мерча",
    hintEditor: "тексты, изображения, страницы, меню, AI",
    subtitle: (a: string, e: string) =>
      `Выдавай должности бойцам — они смогут заходить в админку через свой Discord. Админ: ${a}. Редактор: ${e}. Должности выдаёт только владелец.`,
    add: "Добавить участника",
    idPlaceholder: "Discord ID (17–20 цифр)",
    idTitle: "Discord ID — это число из 17–20 цифр. ПКМ по человеку в Discord → «Копировать ID».",
    namePlaceholder: "Имя / позывной (для себя)",
    optEditor: "Редактор",
    optAdmin: "Админ",
    addBtn: "Добавить",
    idHelp: "Где взять ID: Discord → Настройки → Расширенные → включи «Режим разработчика», потом правый клик по человеку → «Копировать ID пользователя».",
    emptyTeam: "Пока в команде только ты. Добавь первых помощников выше.",
    noName: "Без имени",
    toEditor: "→ редактор",
    toAdmin: "→ админ",
    removeBtn: "Убрать",
    removeConfirm: "Забрать доступ у этого участника?",
  },
  en: {
    back: "← ADMIN PANEL",
    title: "Team",
    roleAdmin: "ADMIN",
    roleEditor: "EDITOR",
    hintAdmin: "all content tools + merch orders",
    hintEditor: "texts, images, pages, menu, AI",
    subtitle: (a: string, e: string) =>
      `Hand out positions — members sign into the admin via their Discord. Admin: ${a}. Editor: ${e}. Only the owner assigns positions.`,
    add: "Add member",
    idPlaceholder: "Discord ID (17–20 digits)",
    idTitle: "A Discord ID is a 17–20 digit number. Right-click a user in Discord → “Copy ID”.",
    namePlaceholder: "Name / callsign (for you)",
    optEditor: "Editor",
    optAdmin: "Admin",
    addBtn: "Add",
    idHelp: "Where to get the ID: Discord → Settings → Advanced → enable Developer Mode, then right-click a user → “Copy User ID”.",
    emptyTeam: "It's just you on the team so far. Add your first helpers above.",
    noName: "No name",
    toEditor: "→ editor",
    toAdmin: "→ admin",
    removeBtn: "Remove",
    removeConfirm: "Remove this member's access?",
  },
} as const;

const ROLE_CLASS: Record<TeamRole, string> = {
  admin: "bg-[color:var(--accent-soft)] text-[color:var(--accent)] border-[color:var(--accent)]/30",
  editor: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
};

export function TeamPanel({
  locale,
  initialMembers,
}: {
  locale: string;
  initialMembers: TeamMember[];
}) {
  const t = STR[locale as keyof typeof STR] || STR.ua;
  const roleLabel = (r: TeamRole) => (r === "admin" ? t.roleAdmin : t.roleEditor);
  const roleHint = (r: TeamRole) => (r === "admin" ? t.hintAdmin : t.hintEditor);
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
    if (!window.confirm(t.removeConfirm)) return;
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
          {t.back}
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-[color:var(--muted-2)] max-w-2xl">
          {t.subtitle(t.hintAdmin, t.hintEditor)}
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
          {t.add}
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder={t.idPlaceholder}
            required
            pattern="\d{17,20}"
            title={t.idTitle}
            className="h-11 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm font-mono focus:outline-none focus:border-[color:var(--accent)]"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t.namePlaceholder}
            className="h-11 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm focus:outline-none focus:border-[color:var(--accent)]"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as TeamRole)}
            className="h-11 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm font-mono focus:outline-none focus:border-[color:var(--accent)]"
          >
            <option value="editor">{t.optEditor}</option>
            <option value="admin">{t.optAdmin}</option>
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
            {t.addBtn}
          </button>
        </div>
        <p className="text-xs text-[color:var(--muted)]">
          {t.idHelp}
        </p>
      </form>

      <div className="flex flex-col gap-3">
        {members.length === 0 && (
          <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-8 text-center text-[color:var(--muted-2)] flex flex-col items-center gap-3">
            <UserGearIcon className="size-8" weight="bold" />
            <span className="text-sm">{t.emptyTeam}</span>
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
                <span className="font-bold truncate">{m.name || t.noName}</span>
                <span className="font-mono text-xs text-[color:var(--muted)] truncate">
                  {m.id}
                </span>
              </div>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-sm font-mono uppercase text-[10px] tracking-[0.16em] border ${ROLE_CLASS[m.role]}`}
                title={roleHint(m.role)}
              >
                {roleLabel(m.role)}
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
                    {m.role === "admin" ? t.toEditor : t.toAdmin}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    className="tactical-text inline-flex items-center gap-1 px-3 h-8 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-rose-300 hover:border-rose-500/40"
                  >
                    <TrashIcon className="size-3.5" weight="bold" />
                    {t.removeBtn}
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
