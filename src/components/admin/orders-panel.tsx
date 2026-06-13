"use client";

import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  EyeIcon,
  TrashIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import type { MerchOrder } from "@/lib/cms/store";

const STR = {
  ua: {
    back: "← АДМІН-ПАНЕЛЬ",
    title: "Замовлення мерчу",
    none: "Поки що замовлень немає.",
    summary: (t: number, n: number, a: number) => `Всього: ${t}, нових: ${n}, в архіві: ${a}.`,
    tabActive: (n: number) => `Активні (${n})`,
    tabArchive: (n: number) => `Архів (${n})`,
    emptyActive: "Активних замовлень немає.",
    emptyArchive: "Архів порожній.",
    sNew: "НОВЕ", sSeen: "ПЕРЕГЛЯНУТО", sDone: "ВИКОНАНО", sCancelled: "СКАСОВАНО",
    seen: "Переглянуто", done: "Виконано", cancel: "Скасувати", restore: "Повернути",
    toArchive: "Архів", fromArchive: "З архіву", del: "Видалити",
    toArchiveT: "В архів", fromArchiveT: "Повернути з архіву", delT: "Видалити назавжди",
    size: "розмір",
    discord: "DISCORD", callsign: "ПОЗИВНИЙ", phone: "ТЕЛЕФОН", city: "МІСТО / НП",
    delConfirm: "Видалити замовлення назавжди разом з прикріпленими фото? Це не можна скасувати.",
    openPhoto: "Відкрити фото в повний розмір",
  },
  ru: {
    back: "← АДМИН-ПАНЕЛЬ",
    title: "Заказы мерча",
    none: "Пока заказов нет.",
    summary: (t: number, n: number, a: number) => `Всего: ${t}, новых: ${n}, в архиве: ${a}.`,
    tabActive: (n: number) => `Активные (${n})`,
    tabArchive: (n: number) => `Архив (${n})`,
    emptyActive: "Активных заказов нет.",
    emptyArchive: "Архив пуст.",
    sNew: "НОВЫЙ", sSeen: "ПРОСМОТРЕНО", sDone: "ВЫПОЛНЕНО", sCancelled: "ОТМЕНЁН",
    seen: "Просмотрено", done: "Выполнено", cancel: "Отменить", restore: "Вернуть",
    toArchive: "Архив", fromArchive: "Из архива", del: "Удалить",
    toArchiveT: "В архив", fromArchiveT: "Вернуть из архива", delT: "Удалить навсегда",
    size: "размер",
    discord: "DISCORD", callsign: "ПОЗЫВНОЙ", phone: "ТЕЛЕФОН", city: "ГОРОД / НП",
    delConfirm: "Удалить заказ навсегда вместе с прикреплёнными фото? Это нельзя отменить.",
    openPhoto: "Открыть фото в полный размер",
  },
  en: {
    back: "← ADMIN PANEL",
    title: "Merch orders",
    none: "No orders yet.",
    summary: (t: number, n: number, a: number) => `Total: ${t}, new: ${n}, archived: ${a}.`,
    tabActive: (n: number) => `Active (${n})`,
    tabArchive: (n: number) => `Archive (${n})`,
    emptyActive: "No active orders.",
    emptyArchive: "Archive is empty.",
    sNew: "NEW", sSeen: "SEEN", sDone: "DONE", sCancelled: "CANCELLED",
    seen: "Seen", done: "Done", cancel: "Cancel", restore: "Reopen",
    toArchive: "Archive", fromArchive: "Unarchive", del: "Delete",
    toArchiveT: "To archive", fromArchiveT: "Restore from archive", delT: "Delete permanently",
    size: "size",
    discord: "DISCORD", callsign: "CALLSIGN", phone: "PHONE", city: "CITY / DEPOT",
    delConfirm: "Delete this order forever along with attached photos? This cannot be undone.",
    openPhoto: "Open photo full size",
  },
} as const;

const STATUS_CLASS: Record<MerchOrder["status"], string> = {
  new: "bg-[color:var(--accent-soft)] text-[color:var(--accent)] border-[color:var(--accent)]/30",
  seen: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export function OrdersPanel({
  locale,
  initialOrders,
}: {
  locale: string;
  initialOrders: MerchOrder[];
}) {
  const t = STR[locale as keyof typeof STR] || STR.ua;
  const dtLoc = locale === "ru" ? "ru-RU" : locale === "en" ? "en-US" : "uk-UA";
  const statusLabel: Record<MerchOrder["status"], string> = {
    new: t.sNew, seen: t.sSeen, done: t.sDone, cancelled: t.sCancelled,
  };
  const [orders, setOrders] = useState(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "archive">("active");

  async function call(method: "PATCH" | "DELETE", id: string, body?: object) {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch(
        method === "DELETE" ? `/api/admin/orders?id=${id}` : "/api/admin/orders",
        {
          method,
          ...(body
            ? {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }
            : {}),
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setOrders(j.orders ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const changeStatus = (id: string, status: MerchOrder["status"]) =>
    call("PATCH", id, { id, status });
  const setArchived = (id: string, archived: boolean) =>
    call("PATCH", id, { id, archived });
  const removeOrder = (id: string) => {
    if (
      window.confirm(t.delConfirm)
    )
      call("DELETE", id);
  };

  const active = orders.filter((o) => !o.archived);
  const archived = orders.filter((o) => o.archived);
  const shown = tab === "active" ? active : archived;
  const fresh = active.filter((o) => o.status === "new").length;

  return (
    <section className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-10 py-10">
      <div className="flex flex-col gap-2 mb-8">
        <Link
          href="/admin"
          className="tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)]"
        >
          {t.back}
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          {t.title}
        </h1>
        <p className="text-sm text-[color:var(--muted-2)]">
          {orders.length === 0
            ? t.none
            : t.summary(orders.length, fresh, archived.length)}
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {(
          [
            ["active", t.tabActive(active.length)],
            ["archive", t.tabArchive(archived.length)],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 h-9 rounded-sm border tactical-text transition-colors ${
              tab === key
                ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                : "border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:border-[color:var(--accent)]/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {err && (
        <div className="mb-6 px-4 py-3 rounded-sm border border-red-500/40 bg-red-500/10 text-red-300 text-sm">
          {err}
        </div>
      )}

      {shown.length === 0 && (
        <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-8 text-center text-[color:var(--muted-2)] text-sm">
          {tab === "active" ? t.emptyActive : t.emptyArchive}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {shown.map((o) => (
          <div
            key={o.id}
            className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-5 flex flex-col gap-4"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-bold tracking-tight">
                    {o.title || o.item}
                    {o.qty > 1 ? ` ×${o.qty}` : ""}
                  </h3>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-sm font-mono uppercase text-[10px] tracking-[0.16em] border ${STATUS_CLASS[o.status]}`}
                  >
                    {statusLabel[o.status]}
                  </span>
                </div>
                <span className="font-mono text-xs text-[color:var(--muted)]">
                  {o.id} · {new Date(o.createdAt).toLocaleString(dtLoc)}
                  {o.price ? ` · ${o.price}` : ""}
                  {o.size ? ` · ${t.size} ${o.size}` : ""}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {busyId === o.id ? (
                  <span className="inline-flex items-center gap-2 px-3 h-8 text-[color:var(--muted-2)] text-xs font-mono">
                    <CircleNotchIcon className="size-4 animate-spin" weight="bold" />
                  </span>
                ) : (
                  <>
                    {o.status === "new" && (
                      <button
                        type="button"
                        onClick={() => changeStatus(o.id, "seen")}
                        className="inline-flex items-center gap-1 px-3 h-8 rounded-sm border border-[color:var(--border)] hover:border-cyan-500/40 hover:text-cyan-300 transition-colors text-xs font-mono uppercase tracking-[0.1em]"
                      >
                        <EyeIcon className="size-3.5" weight="bold" />
                        {t.seen}
                      </button>
                    )}
                    {o.status !== "done" && o.status !== "cancelled" && (
                      <>
                        <button
                          type="button"
                          onClick={() => changeStatus(o.id, "done")}
                          className="inline-flex items-center gap-1 px-3 h-8 rounded-sm border border-[color:var(--border)] hover:border-emerald-500/40 hover:text-emerald-300 transition-colors text-xs font-mono uppercase tracking-[0.1em]"
                        >
                          <CheckCircleIcon className="size-3.5" weight="bold" />
                          {t.done}
                        </button>
                        <button
                          type="button"
                          onClick={() => changeStatus(o.id, "cancelled")}
                          className="inline-flex items-center gap-1 px-3 h-8 rounded-sm border border-[color:var(--border)] hover:border-rose-500/40 hover:text-rose-300 transition-colors text-xs font-mono uppercase tracking-[0.1em]"
                        >
                          <XCircleIcon className="size-3.5" weight="bold" />
                          {t.cancel}
                        </button>
                      </>
                    )}
                    {(o.status === "done" || o.status === "cancelled") && (
                      <button
                        type="button"
                        onClick={() => changeStatus(o.id, "new")}
                        className="inline-flex items-center gap-1 px-3 h-8 rounded-sm border border-[color:var(--border)] hover:border-[color:var(--accent)]/40 hover:text-[color:var(--accent)] transition-colors text-xs font-mono uppercase tracking-[0.1em]"
                      >
                        <ArrowCounterClockwiseIcon className="size-3.5" weight="bold" />
                        {t.restore}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setArchived(o.id, !o.archived)}
                      title={o.archived ? t.fromArchiveT : t.toArchiveT}
                      className="inline-flex items-center gap-1 px-3 h-8 rounded-sm border border-[color:var(--border)] hover:border-[color:var(--accent)]/40 hover:text-[color:var(--accent)] transition-colors text-xs font-mono uppercase tracking-[0.1em]"
                    >
                      <ArchiveIcon className="size-3.5" weight="bold" />
                      {o.archived ? t.fromArchive : t.toArchive}
                    </button>
                    {o.archived && (
                      <button
                        type="button"
                        onClick={() => removeOrder(o.id)}
                        title={t.delT}
                        className="inline-flex items-center gap-1 px-3 h-8 rounded-sm border border-[color:var(--border)] hover:border-rose-500/40 hover:text-rose-300 transition-colors text-xs font-mono uppercase tracking-[0.1em]"
                      >
                        <TrashIcon className="size-3.5" weight="bold" />
                        {t.del}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div className="flex flex-col">
                <span className="tactical-text text-[color:var(--muted)]">{t.discord}</span>
                <span className="font-mono">{o.discord || "—"}</span>
              </div>
              <div className="flex flex-col">
                <span className="tactical-text text-[color:var(--muted)]">{t.callsign}</span>
                <span className="font-mono">{o.callsign || "—"}</span>
              </div>
              <div className="flex flex-col">
                <span className="tactical-text text-[color:var(--muted)]">{t.phone}</span>
                <span className="font-mono">{o.phone || "—"}</span>
              </div>
              <div className="flex flex-col">
                <span className="tactical-text text-[color:var(--muted)]">{t.city}</span>
                <span>{o.city || "—"}</span>
              </div>
            </div>

            {o.notes && (
              <p className="text-sm text-[color:var(--muted-2)] border-t border-[color:var(--border)] pt-3 whitespace-pre-wrap">
                {o.notes}
              </p>
            )}

            {o.images && o.images.length > 0 && (
              <div className="flex gap-2 flex-wrap border-t border-[color:var(--border)] pt-3">
                {o.images.map((f) => (
                  <a
                    key={f}
                    href={`/api/admin/orders/image/${f}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t.openPhoto}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/admin/orders/image/${f}`}
                      alt=""
                      className="size-20 object-cover rounded-sm border border-[color:var(--border-strong)] hover:border-[color:var(--accent)]"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
