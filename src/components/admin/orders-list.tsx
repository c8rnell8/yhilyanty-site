"use client";

import {
  CheckCircleIcon,
  CircleNotchIcon,
  ClockCountdownIcon,
  EnvelopeSimpleIcon,
  PackageIcon,
  PhoneIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { Link } from "@/i18n/navigation";
import type { MerchOrder, MerchOrderStatus } from "@/lib/cms/store";

type Props = { initialOrders: MerchOrder[] };

const STATUS_LABEL: Record<MerchOrderStatus, string> = {
  new: "Нове",
  in_progress: "В роботі",
  done: "Виконано",
  cancelled: "Скасовано",
};

const STATUS_CLASS: Record<MerchOrderStatus, string> = {
  new: "bg-[color:var(--accent-soft)] text-[color:var(--accent)] border-[color:var(--accent)]/40",
  in_progress: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export function OrdersList({ initialOrders }: Props) {
  const [orders, setOrders] = useState<MerchOrder[]>(initialOrders);
  const [filter, setFilter] = useState<"all" | MerchOrderStatus>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: orders.length };
    for (const k of Object.keys(STATUS_LABEL)) out[k] = 0;
    for (const o of orders) out[o.status || "new"]++;
    return out;
  }, [orders]);

  const filtered = useMemo(() => {
    if (filter === "all") return orders;
    return orders.filter((o) => (o.status || "new") === filter);
  }, [orders, filter]);

  async function setStatus(id: string, status: MerchOrderStatus) {
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        order?: MerchOrder;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      if (j.order) {
        setOrders((cur) => cur.map((o) => (o.id === id ? j.order! : o)));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Видалити замовлення безповоротно?")) return;
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/orders?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setOrders((cur) => cur.filter((o) => o.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
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
          <h1 className="text-3xl font-bold tracking-tight">Замовлення мерчу</h1>
          <p className="text-sm text-[color:var(--muted-2)] max-w-2xl">
            Усі замовлення з форми сайту. Оновлюй статус після опрацювання — це
            допомагає не загубити жодного клієнта. Видалення стирає файл повністю
            (для завершених замовлень).
          </p>
        </div>
        <div className="flex flex-col gap-1 text-right">
          <span className="tactical-text text-[color:var(--muted)]">УСЬОГО</span>
          <span className="text-3xl font-bold">{orders.length}</span>
        </div>
      </div>

      {err ? (
        <div className="mb-6 flex items-center gap-2 p-3 rounded-sm border border-rose-500/40 bg-rose-500/10 text-rose-200 text-sm">
          <WarningCircleIcon className="size-5" weight="fill" />
          <span>{err}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 mb-6">
        {(
          [
            ["all", "Усі"],
            ["new", STATUS_LABEL.new],
            ["in_progress", STATUS_LABEL.in_progress],
            ["done", STATUS_LABEL.done],
            ["cancelled", STATUS_LABEL.cancelled],
          ] as const
        ).map(([k, label]) => {
          const active = filter === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`px-3 h-9 rounded-sm border text-xs font-mono uppercase tracking-[0.12em] inline-flex items-center gap-1.5 ${
                active
                  ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                  : "border-[color:var(--border)] hover:border-[color:var(--accent)]/40"
              }`}
            >
              {label}
              <span className="text-[10px] opacity-70">({counts[k] || 0})</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-12 text-center">
          <PackageIcon
            className="mx-auto size-10 text-[color:var(--muted)] mb-3"
            weight="bold"
          />
          <p className="tactical-text text-[color:var(--muted)]">
            ЗАМОВЛЕНЬ ПОКИ НЕМАЄ
          </p>
          <p className="text-sm text-[color:var(--muted-2)] mt-1">
            Як тільки хтось оформить замовлення на сайті — воно з’явиться тут.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((o) => {
            const status: MerchOrderStatus = o.status || "new";
            const date = new Date(o.createdAt);
            const dateStr = isNaN(date.getTime())
              ? o.createdAt
              : date.toLocaleString("uk-UA", {
                  dateStyle: "short",
                  timeStyle: "short",
                });
            const isBusy = busy === o.id;
            return (
              <article
                key={o.id}
                className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-5 flex flex-col gap-4"
              >
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 rounded-sm bg-[color:var(--accent)] flex items-center justify-center shrink-0">
                      <PackageIcon
                        className="size-5 text-black"
                        weight="bold"
                      />
                    </div>
                    <div className="flex flex-col leading-tight min-w-0">
                      <span className="font-bold tracking-tight truncate">
                        {o.title || o.item}
                      </span>
                      <span className="font-mono text-[11px] text-[color:var(--muted)] truncate">
                        {o.id} · {dateStr}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`tactical-text px-2 py-1 rounded-sm border ${STATUS_CLASS[status]}`}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </header>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                  <DataField
                    icon={<EnvelopeSimpleIcon className="size-4" weight="bold" />}
                    label="Discord"
                  >
                    {o.discord}
                  </DataField>
                  <DataField
                    icon={<PhoneIcon className="size-4" weight="bold" />}
                    label="Телефон"
                  >
                    <a
                      href={`tel:${o.phone}`}
                      className="hover:text-[color:var(--accent)]"
                    >
                      {o.phone}
                    </a>
                  </DataField>
                  <DataField label="Місто / НП">{o.city}</DataField>
                  <DataField label="Кількість">
                    {o.qty}
                    {o.size ? ` · ${o.size}` : ""}
                  </DataField>
                  {o.callsign ? (
                    <DataField label="Позивний">{o.callsign}</DataField>
                  ) : null}
                  {o.price ? (
                    <DataField label="Ціна">{o.price}</DataField>
                  ) : null}
                </div>

                {o.notes ? (
                  <div className="rounded-sm border border-[color:var(--border)] bg-black/20 p-3 text-sm whitespace-pre-line">
                    <span className="tactical-text text-[color:var(--muted-2)] mb-1 block">
                      Примітки
                    </span>
                    {o.notes}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[color:var(--border)]">
                  {(["new", "in_progress", "done", "cancelled"] as const).map(
                    (s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={isBusy || status === s}
                        onClick={() => setStatus(o.id, s)}
                        className={`px-3 h-9 rounded-sm border text-xs font-mono uppercase tracking-[0.12em] inline-flex items-center gap-1 disabled:opacity-50 ${
                          status === s
                            ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                            : "border-[color:var(--border)] hover:border-[color:var(--accent)]/40"
                        }`}
                      >
                        {s === "done" ? (
                          <CheckCircleIcon className="size-3.5" weight="bold" />
                        ) : s === "in_progress" ? (
                          <ClockCountdownIcon className="size-3.5" weight="bold" />
                        ) : null}
                        {STATUS_LABEL[s]}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => remove(o.id)}
                    className="ml-auto px-3 h-9 rounded-sm border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs font-mono uppercase tracking-[0.12em] inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    {isBusy ? (
                      <CircleNotchIcon
                        className="size-3.5 animate-spin"
                        weight="bold"
                      />
                    ) : (
                      <TrashIcon className="size-3.5" weight="bold" />
                    )}
                    Видалити
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DataField(props: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="tactical-text text-[color:var(--muted-2)] inline-flex items-center gap-1">
        {props.icon}
        {props.label}
      </span>
      <span className="font-mono text-sm break-words">{props.children}</span>
    </div>
  );
}
