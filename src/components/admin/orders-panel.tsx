"use client";

import {
  ArchiveIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  EyeIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import type { MerchOrder } from "@/lib/cms/store";

const STATUS_LABEL: Record<MerchOrder["status"], string> = {
  new: "НОВЕ",
  seen: "ПЕРЕГЛЯНУТО",
  done: "ВИКОНАНО",
  cancelled: "СКАСОВАНО",
};

const STATUS_CLASS: Record<MerchOrder["status"], string> = {
  new: "bg-[color:var(--accent-soft)] text-[color:var(--accent)] border-[color:var(--accent)]/30",
  seen: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export function OrdersPanel({ initialOrders }: { initialOrders: MerchOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function changeStatus(id: string, status: MerchOrder["status"]) {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setOrders(j.orders ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const fresh = orders.filter((o) => o.status === "new").length;

  return (
    <section className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-10 py-10">
      <div className="flex flex-col gap-2 mb-8">
        <Link
          href="/admin"
          className="tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)]"
        >
          ← АДМІН-ПАНЕЛЬ
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Замовлення мерчу
        </h1>
        <p className="text-sm text-[color:var(--muted-2)]">
          {orders.length === 0
            ? "Поки що замовлень немає."
            : `Всього: ${orders.length}, нових: ${fresh}.`}
        </p>
      </div>

      {err && (
        <div className="mb-6 px-4 py-3 rounded-sm border border-red-500/40 bg-red-500/10 text-red-300 text-sm">
          {err}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {orders.map((o) => (
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
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
                <span className="font-mono text-xs text-[color:var(--muted)]">
                  {o.id} · {new Date(o.createdAt).toLocaleString("uk-UA")}
                  {o.price ? ` · ${o.price}` : ""}
                  {o.size ? ` · розмір ${o.size}` : ""}
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
                        Переглянуто
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
                          Виконано
                        </button>
                        <button
                          type="button"
                          onClick={() => changeStatus(o.id, "cancelled")}
                          className="inline-flex items-center gap-1 px-3 h-8 rounded-sm border border-[color:var(--border)] hover:border-rose-500/40 hover:text-rose-300 transition-colors text-xs font-mono uppercase tracking-[0.1em]"
                        >
                          <XCircleIcon className="size-3.5" weight="bold" />
                          Скасувати
                        </button>
                      </>
                    )}
                    {(o.status === "done" || o.status === "cancelled") && (
                      <button
                        type="button"
                        onClick={() => changeStatus(o.id, "new")}
                        className="inline-flex items-center gap-1 px-3 h-8 rounded-sm border border-[color:var(--border)] hover:border-[color:var(--accent)]/40 hover:text-[color:var(--accent)] transition-colors text-xs font-mono uppercase tracking-[0.1em]"
                      >
                        <ArchiveIcon className="size-3.5" weight="bold" />
                        Повернути
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div className="flex flex-col">
                <span className="tactical-text text-[color:var(--muted)]">DISCORD</span>
                <span className="font-mono">{o.discord || "—"}</span>
              </div>
              <div className="flex flex-col">
                <span className="tactical-text text-[color:var(--muted)]">ПОЗИВНИЙ</span>
                <span className="font-mono">{o.callsign || "—"}</span>
              </div>
              <div className="flex flex-col">
                <span className="tactical-text text-[color:var(--muted)]">ТЕЛЕФОН</span>
                <span className="font-mono">{o.phone || "—"}</span>
              </div>
              <div className="flex flex-col">
                <span className="tactical-text text-[color:var(--muted)]">МІСТО / НП</span>
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
                    title="Відкрити фото в повний розмір"
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
