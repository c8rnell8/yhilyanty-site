"use client";

import { useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  DotsSixVerticalIcon,
  EyeIcon,
  EyeSlashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import { Link } from "@/i18n/navigation";
import type { SectionDef } from "@/lib/cms/sections";

export function LayoutEditor({
  sections,
  initialOrder,
  initialHidden,
}: {
  sections: SectionDef[];
  initialOrder: string[];
  initialHidden: string[];
}) {
  const [order, setOrder] = useState<string[]>(initialOrder);
  const [hidden, setHidden] = useState<Set<string>>(new Set(initialHidden));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const handleDragStart = (key: string) => (e: React.DragEvent<HTMLLIElement>) => {
    setDraggingKey(key);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", key);
  };
  const handleDragOver = (key: string) => (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverKey !== key) setDragOverKey(key);
  };
  const handleDragLeave = () => {
    setDragOverKey(null);
  };
  const handleDrop = (targetKey: string) => (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    const sourceKey = draggingKey || e.dataTransfer.getData("text/plain");
    setDraggingKey(null);
    setDragOverKey(null);
    if (!sourceKey || sourceKey === targetKey) return;
    setOrder((prev) => {
      const srcIdx = prev.indexOf(sourceKey);
      const tgtIdx = prev.indexOf(targetKey);
      if (srcIdx === -1 || tgtIdx === -1) return prev;
      const next = [...prev];
      next.splice(srcIdx, 1);
      next.splice(tgtIdx, 0, sourceKey);
      return next;
    });
  };
  const handleDragEnd = () => {
    setDraggingKey(null);
    setDragOverKey(null);
  };

  const byKey = Object.fromEntries(sections.map((s) => [s.key, s]));

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...order];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setOrder(next);
  };

  const toggleHide = (key: string) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setHidden(next);
  };

  const reset = () => {
    setOrder(sections.map((s) => s.key));
    setHidden(new Set());
  };

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: "landing",
          sections: order,
          hidden: Array.from(hidden),
        }),
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

  return (
    <section className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-12 lg:py-16">
      <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/admin"
            className="tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)]"
          >
            ← АДМІН-ПАНЕЛЬ
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Секції лендінгу
          </h1>
          <p className="text-sm text-[color:var(--muted-2)] max-w-2xl">
            Переставляй порядок або ховай цілі секції. Після збереження
            лендінг одразу перерендериться.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
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
          ЛЕЙАУТ ЗБЕРЕЖЕНО
        </div>
      )}
      {err && (
        <div className="mb-4 px-4 py-2 rounded-sm border border-red-500/40 bg-red-500/10 text-red-300 tactical-text inline-flex items-center gap-2">
          <WarningCircleIcon className="size-4" weight="fill" />
          {err}
        </div>
      )}

      <ul className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] divide-y divide-[color:var(--border)]">
        {order.map((key, idx) => {
          const def = byKey[key];
          if (!def) return null;
          const isHidden = hidden.has(key);
          return (
            <li
              key={key}
              draggable
              onDragStart={handleDragStart(key)}
              onDragOver={handleDragOver(key)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(key)}
              onDragEnd={handleDragEnd}
              className={`p-4 flex items-center gap-4 transition-colors ${
                isHidden ? "opacity-50" : ""
              } ${
                draggingKey === key
                  ? "bg-[color:var(--accent)]/5 ring-1 ring-[color:var(--accent)]/40"
                  : dragOverKey === key && draggingKey && draggingKey !== key
                    ? "bg-[color:var(--accent)]/10 ring-1 ring-[color:var(--accent)]"
                    : ""
              }`}
            >
              <span
                className="shrink-0 size-8 inline-flex items-center justify-center rounded-sm text-[color:var(--muted)] cursor-grab active:cursor-grabbing select-none"
                title="Перетягни щоб змінити порядок"
                aria-hidden
              >
                <DotsSixVerticalIcon className="size-5" weight="bold" />
              </span>
              <span className="font-mono text-sm text-[color:var(--muted)] w-8 text-right shrink-0">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm tracking-tight">{def.label}</span>
                  <span className="font-mono text-[10px] text-[color:var(--accent)]">{def.key}</span>
                  {isHidden && (
                    <span className="tactical-text text-[10px] px-1.5 py-0.5 rounded-sm border border-[color:var(--muted)] text-[color:var(--muted-2)]">
                      HIDDEN
                    </span>
                  )}
                </div>
                <p className="text-xs text-[color:var(--muted-2)] mt-0.5">{def.description}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  title="Вище"
                  className="size-9 inline-flex items-center justify-center rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowUpIcon className="size-4" weight="bold" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === order.length - 1}
                  title="Нижче"
                  className="size-9 inline-flex items-center justify-center rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowDownIcon className="size-4" weight="bold" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleHide(key)}
                  title={isHidden ? "Показати" : "Сховати"}
                  className={`size-9 inline-flex items-center justify-center rounded-sm border transition-colors ${
                    isHidden
                      ? "border-[color:var(--muted)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40"
                      : "border-[color:var(--accent)]/40 text-[color:var(--accent)] hover:border-[color:var(--accent)]"
                  }`}
                >
                  {isHidden ? (
                    <EyeSlashIcon className="size-4" weight="bold" />
                  ) : (
                    <EyeIcon className="size-4" weight="bold" />
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
