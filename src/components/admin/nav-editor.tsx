"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  DotsSixVerticalIcon,
  PlusIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import type { NavItem, NavOverrides } from "@/lib/cms/store";

type Locale = "ua" | "ru" | "en";
const LOCALES: Locale[] = ["ua", "ru", "en"];

function genId(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6)
  );
}

type DefaultHref = { href: string; key: string };
type CustomPage = { slug: string; name: string };

const KEY_LABELS: Record<string, string> = {
  home: "Головна",
  join: "Вступ",
  roster: "Ростер",
  merch: "Мерч",
  bot: "Бот",
};

function makeDefaultItems(defaultHrefs: DefaultHref[]): NavItem[] {
  return defaultHrefs.map((d) => ({
    id: genId(),
    label: {
      ua: KEY_LABELS[d.key] || d.key,
      ru: KEY_LABELS[d.key] || d.key,
      en: d.key.charAt(0).toUpperCase() + d.key.slice(1),
    },
    href: d.href,
    locked: d.href === "/",
  }));
}

export function NavEditor({
  initialOverrides,
  defaultHrefs,
  customPages,
}: {
  initialOverrides: NavOverrides;
  defaultHrefs: DefaultHref[];
  customPages: CustomPage[];
}) {
  const [navbar, setNavbar] = useState<NavItem[]>(
    initialOverrides.navbar && initialOverrides.navbar.length > 0
      ? initialOverrides.navbar
      : makeDefaultItems(defaultHrefs),
  );
  const [footer, setFooter] = useState<NavItem[]>(
    initialOverrides.footer && initialOverrides.footer.length > 0
      ? initialOverrides.footer
      : makeDefaultItems(defaultHrefs),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/nav", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ navbar, footer }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function resetToDefault() {
    if (!confirm("Скинути обидва меню до стандартних пунктів?")) return;
    setNavbar(makeDefaultItems(defaultHrefs));
    setFooter(makeDefaultItems(defaultHrefs));
  }

  return (
    <section className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-10">
      <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/admin"
            className="tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)]"
          >
            ← АДМІН-ПАНЕЛЬ
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Навбар і футер
          </h1>
          <p className="text-sm text-[color:var(--muted-2)] max-w-2xl">
            Додавай, перейменовуй, переставляй або видаляй пункти меню. Пункт «Адмін»
            з&apos;являється автоматично для власника і не редагується. Пункт
            «Головна» не можна видалити (але можна переіменувати).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetToDefault}
            className="tactical-text px-3 h-10 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40"
          >
            DEFAULT
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="tactical-text inline-flex items-center gap-2 px-4 h-10 rounded-sm bg-[color:var(--accent)] text-black font-bold hover:bg-[color:var(--accent-hard)] disabled:opacity-50"
          >
            {busy ? (
              <CircleNotchIcon className="size-4 animate-spin" weight="bold" />
            ) : (
              <CheckCircleIcon className="size-4" weight="bold" />
            )}
            SAVE
          </button>
        </div>
      </div>

      {saved && (
        <div className="mb-4 px-4 py-2 rounded-sm border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 tactical-text inline-flex items-center gap-2">
          <CheckCircleIcon className="size-4" weight="fill" />
          МЕНЮ ЗБЕРЕЖЕНО
        </div>
      )}
      {err && (
        <div className="mb-4 px-4 py-2 rounded-sm border border-red-500/40 bg-red-500/10 text-red-300 tactical-text inline-flex items-center gap-2">
          <WarningCircleIcon className="size-4" weight="fill" />
          {err}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <MenuColumn
          title="Навбар (верхнє меню)"
          items={navbar}
          onChange={setNavbar}
          customPages={customPages}
        />
        <MenuColumn
          title="Футер (низ сайту)"
          items={footer}
          onChange={setFooter}
          customPages={customPages}
        />
      </div>
    </section>
  );
}

function MenuColumn({
  title,
  items,
  onChange,
  customPages,
}: {
  title: string;
  items: NavItem[];
  onChange: (next: NavItem[]) => void;
  customPages: CustomPage[];
}) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const patch = (id: string, p: Partial<NavItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...p } : it)));

  const patchLabel = (id: string, locale: Locale, value: string) => {
    const cur = items.find((i) => i.id === id);
    if (!cur) return;
    patch(id, { label: { ...cur.label, [locale]: value } });
  };

  const move = (idx: number, dir: -1 | 1) => {
    const t = idx + dir;
    if (t < 0 || t >= items.length) return;
    const next = [...items];
    [next[idx], next[t]] = [next[t], next[idx]];
    onChange(next);
  };

  const remove = (id: string) => {
    const cur = items.find((i) => i.id === id);
    if (cur?.locked) return;
    onChange(items.filter((i) => i.id !== id));
  };

  const add = () =>
    onChange([
      ...items,
      {
        id: genId(),
        label: { ua: "Новий пункт", ru: "Новый пункт", en: "New item" },
        href: "/",
      },
    ]);

  const onDragStart = (key: string) => (e: React.DragEvent) => {
    setDragKey(key);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", key);
  };
  const onDragOver = (key: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragOverKey !== key) setDragOverKey(key);
  };
  const onDragLeave = () => setDragOverKey(null);
  const onDrop = (targetKey: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const srcKey = dragKey || e.dataTransfer.getData("text/plain");
    setDragKey(null);
    setDragOverKey(null);
    if (!srcKey || srcKey === targetKey) return;
    const si = items.findIndex((i) => i.id === srcKey);
    const ti = items.findIndex((i) => i.id === targetKey);
    if (si === -1 || ti === -1) return;
    const next = [...items];
    const [moved] = next.splice(si, 1);
    next.splice(ti, 0, moved);
    onChange(next);
  };
  const onDragEnd = () => {
    setDragKey(null);
    setDragOverKey(null);
  };

  return (
    <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-4">
      <h2 className="text-sm font-mono uppercase tracking-[0.14em] text-[color:var(--accent)] mb-4">
        {title}
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((it, idx) => {
          const isDragging = dragKey === it.id;
          const isDragOver = dragOverKey === it.id && dragKey && dragKey !== it.id;
          return (
            <li
              key={it.id}
              draggable
              onDragStart={onDragStart(it.id)}
              onDragOver={onDragOver(it.id)}
              onDragLeave={onDragLeave}
              onDrop={onDrop(it.id)}
              onDragEnd={onDragEnd}
              className={`rounded-sm border bg-black/20 p-3 transition-colors ${
                isDragging
                  ? "border-[color:var(--accent)]/60 opacity-60"
                  : isDragOver
                    ? "border-[color:var(--accent)]"
                    : "border-[color:var(--border)]"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="shrink-0 size-6 inline-flex items-center justify-center text-[color:var(--muted)] cursor-grab active:cursor-grabbing"
                  aria-hidden
                >
                  <DotsSixVerticalIcon className="size-4" weight="bold" />
                </span>
                <span className="font-mono text-[10px] text-[color:var(--muted)]">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                {it.locked && (
                  <span className="tactical-text text-[10px] px-1.5 py-0.5 rounded-sm border border-[color:var(--accent)]/40 text-[color:var(--accent)]">
                    LOCKED
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="size-7 inline-flex items-center justify-center rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 disabled:opacity-30"
                    title="Вище"
                  >
                    <ArrowUpIcon className="size-3.5" weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === items.length - 1}
                    className="size-7 inline-flex items-center justify-center rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 disabled:opacity-30"
                    title="Нижче"
                  >
                    <ArrowDownIcon className="size-3.5" weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(it.id)}
                    disabled={it.locked}
                    className="size-7 inline-flex items-center justify-center rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-rose-300 hover:border-rose-500/40 disabled:opacity-30 disabled:hover:text-[color:var(--muted-2)]"
                    title={it.locked ? "Цей пункт не можна видалити" : "Видалити"}
                  >
                    <TrashIcon className="size-3.5" weight="bold" />
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 mb-2">
                {LOCALES.map((lc) => (
                  <input
                    key={lc}
                    value={it.label[lc] || ""}
                    onChange={(e) => patchLabel(it.id, lc, e.target.value)}
                    placeholder={lc.toUpperCase()}
                    className="h-9 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm focus:border-[color:var(--accent)] outline-none"
                  />
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-end">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[color:var(--muted)]">
                    ПОСИЛАННЯ
                  </span>
                  <input
                    value={it.href}
                    onChange={(e) => patch(it.id, { href: e.target.value })}
                    placeholder="/join  або  https://discord.gg/..."
                    className="h-9 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] font-mono text-xs focus:border-[color:var(--accent)] outline-none"
                  />
                </label>
                {customPages.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) patch(it.id, { href: e.target.value });
                      e.currentTarget.selectedIndex = 0;
                    }}
                    className="h-9 px-2 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-xs focus:border-[color:var(--accent)] outline-none"
                    title="Вставити посилання на власну сторінку"
                  >
                    <option value="">Вставити сторінку…</option>
                    {customPages.map((p) => (
                      <option key={p.slug} value={`/p/${p.slug}`}>
                        /p/{p.slug} — {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={add}
        className="mt-4 w-full tactical-text inline-flex items-center justify-center gap-2 h-10 rounded-sm border-2 border-dashed border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/60"
      >
        <PlusIcon className="size-4" weight="bold" />
        ДОДАТИ ПУНКТ
      </button>
    </div>
  );
}
