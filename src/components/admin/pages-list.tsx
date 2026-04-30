"use client";

import {
  PlusIcon,
  PencilSimpleIcon,
  TrashIcon,
  ArrowSquareOutIcon,
  FileTextIcon,
  CircleNotchIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import type { PageDoc } from "@/lib/cms/store";

export function PagesList({ initialPages }: { initialPages: PageDoc[] }) {
  const [pages, setPages] = useState<PageDoc[]>(initialPages);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const router = useRouter();

  async function create() {
    setErr(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: newSlug,
          title: { ua: newTitle, ru: newTitle, en: newTitle },
          blocks: [],
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      router.push(`/admin/pages/${j.page.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Видалити цю сторінку? Дія незворотня.")) return;
    setDeleting(id);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/pages?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setPages((ps) => ps.filter((p) => p.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-10 py-12">
      <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/admin"
            className="tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)]"
          >
            ← АДМІН-ПАНЕЛЬ
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Сторінки</h1>
          <p className="text-sm text-[color:var(--muted-2)] max-w-2xl">
            Будь-яка сторінка, яку ти створиш тут, доступна за адресою{" "}
            <code className="font-mono text-[color:var(--accent)]">/p/&lt;slug&gt;</code>.
            Не забудь додати її в навбар або футер, якщо хочеш щоб відвідувачі знайшли.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="tactical-text inline-flex items-center gap-2 px-4 h-10 rounded-sm bg-[color:var(--accent)] text-black font-bold hover:bg-[color:var(--accent-hard)]"
        >
          <PlusIcon className="size-4" weight="bold" />
          НОВА СТОРІНКА
        </button>
      </div>

      {err && (
        <div className="mb-4 px-4 py-2 rounded-sm border border-red-500/40 bg-red-500/10 text-red-300 tactical-text inline-flex items-center gap-2">
          <WarningCircleIcon className="size-4" weight="fill" />
          {err}
        </div>
      )}

      {showNew && (
        <div className="mb-8 rounded-sm border border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)]/10 p-5">
          <h3 className="text-sm font-mono uppercase tracking-[0.14em] text-[color:var(--accent)] mb-3">
            Нова сторінка
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--muted)]">
                SLUG (URL) — латиницею, через дефіс
              </span>
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="new-page"
                className="h-10 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] font-mono text-sm focus:border-[color:var(--accent)] outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--muted)]">
                ЗАГОЛОВОК (можна змінити пізніше, задасться на всіх мовах)
              </span>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Назва"
                className="h-10 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm focus:border-[color:var(--accent)] outline-none"
              />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={create}
              disabled={creating || !newSlug.trim()}
              className="tactical-text inline-flex items-center gap-2 px-4 h-10 rounded-sm bg-[color:var(--accent)] text-black font-bold hover:bg-[color:var(--accent-hard)] disabled:opacity-50"
            >
              {creating ? (
                <CircleNotchIcon className="size-4 animate-spin" weight="bold" />
              ) : (
                <PlusIcon className="size-4" weight="bold" />
              )}
              СТВОРИТИ
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNew(false);
                setNewSlug("");
                setNewTitle("");
              }}
              className="tactical-text px-3 h-10 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40"
            >
              СКАСУВАТИ
            </button>
          </div>
        </div>
      )}

      {pages.length === 0 ? (
        <div className="rounded-sm border border-dashed border-[color:var(--border)] bg-[color:var(--background-elev)] p-10 text-center">
          <FileTextIcon
            className="size-10 text-[color:var(--muted)] mx-auto mb-3"
            weight="thin"
          />
          <p className="text-[color:var(--muted-2)]">
            Ще жодної сторінки. Натисни «Нова сторінка» вгорі.
          </p>
        </div>
      ) : (
        <ul className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] divide-y divide-[color:var(--border)]">
          {pages.map((p) => {
            const name = p.title.ua || p.title.ru || p.title.en || p.slug;
            return (
              <li key={p.id} className="p-4 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base tracking-tight">{name}</span>
                    <code className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-black/50 text-[color:var(--accent)]">
                      /p/{p.slug}
                    </code>
                  </div>
                  <div className="text-xs text-[color:var(--muted)] mt-1 font-mono">
                    {p.blocks.length} блок(ів) · оновлено{" "}
                    {new Date(p.updatedAt).toLocaleString("uk-UA")}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/p/${p.slug}` as never}
                    className="tactical-text inline-flex items-center gap-1.5 px-3 h-9 rounded-sm border border-[color:var(--border-strong)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                  >
                    <ArrowSquareOutIcon className="size-4" weight="bold" />
                    ВІДКРИТИ
                  </Link>
                  <Link
                    href={`/admin/pages/${p.id}` as never}
                    className="tactical-text inline-flex items-center gap-1.5 px-3 h-9 rounded-sm bg-[color:var(--accent)] text-black font-bold hover:bg-[color:var(--accent-hard)]"
                  >
                    <PencilSimpleIcon className="size-4" weight="bold" />
                    РЕДАГУВАТИ
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    disabled={deleting === p.id}
                    className="size-9 inline-flex items-center justify-center rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-rose-300 hover:border-rose-500/40 disabled:opacity-50"
                    title="Видалити сторінку"
                  >
                    {deleting === p.id ? (
                      <CircleNotchIcon className="size-4 animate-spin" weight="bold" />
                    ) : (
                      <TrashIcon className="size-4" weight="bold" />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
