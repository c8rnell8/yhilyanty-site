"use client";

import { useState } from "react";
import {
  PaperPlaneTiltIcon,
  CheckCircleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

type Strings = {
  formTitle: string;
  formIntro: string;
  discord: string;
  discordPlaceholder: string;
  callsign: string;
  callsignPlaceholder: string;
  phone: string;
  phonePlaceholder: string;
  city: string;
  cityPlaceholder: string;
  qty: string;
  size: string;
  sizeNotApplicable: string;
  notes: string;
  notesPlaceholder: string;
  submit: string;
  successTitle: string;
  successBody: string;
};

export function OrderForm({
  itemKey,
  title,
  price,
  sizes,
  strings: s,
}: {
  itemKey: string;
  title: string;
  price: string;
  sizes: string[];
  strings: Strings;
}) {
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      itemKey,
      itemTitle: title,
      itemPrice: price,
      discord: String(fd.get("discord") || ""),
      callsign: String(fd.get("callsign") || ""),
      phone: String(fd.get("phone") || ""),
      city: String(fd.get("city") || ""),
      qty: Number(fd.get("qty") || 1),
      size: String(fd.get("size") || ""),
      notes: String(fd.get("notes") || ""),
    };
    try {
      const res = await fetch("/api/merch/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "unknown error");
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-sm border border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)] p-6 flex flex-col gap-3">
        <CheckCircleIcon
          className="size-10 text-[color:var(--accent)]"
          weight="duotone"
        />
        <h2 className="text-xl font-bold tracking-tight">{s.successTitle}</h2>
        <p className="text-sm text-[color:var(--muted-2)] leading-relaxed">
          {s.successBody}
        </p>
      </div>
    );
  }

  const inputCls =
    "h-11 px-3 rounded-sm bg-[color:var(--background)] border border-[color:var(--border-strong)] focus:border-[color:var(--accent)] focus:outline-none text-sm placeholder:text-[color:var(--muted)]";
  const labelCls = "tactical-text text-[color:var(--muted-2)]";

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--background-elev)] p-6 flex flex-col gap-5"
    >
      <header className="flex flex-col gap-1.5 pb-4 border-b border-[color:var(--border)]">
        <h2 className="text-2xl font-bold tracking-tight">{s.formTitle}</h2>
        <p className="text-sm text-[color:var(--muted-2)] leading-relaxed">
          {s.formIntro}
        </p>
      </header>

      <div className="flex items-center justify-between p-3 rounded-sm bg-[color:var(--background)] border border-[color:var(--border)]">
        <span className="text-sm font-medium">{title}</span>
        <span className="font-mono text-sm text-[color:var(--accent)]">
          {price}
        </span>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>{s.discord} *</span>
        <input
          name="discord"
          required
          placeholder={s.discordPlaceholder}
          className={inputCls}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{s.callsign}</span>
          <input
            name="callsign"
            placeholder={s.callsignPlaceholder}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{s.phone} *</span>
          <input
            name="phone"
            required
            type="tel"
            placeholder={s.phonePlaceholder}
            className={inputCls}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>{s.city} *</span>
        <input
          name="city"
          required
          placeholder={s.cityPlaceholder}
          className={inputCls}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{s.qty} *</span>
          <input
            name="qty"
            type="number"
            min={1}
            max={20}
            defaultValue={1}
            required
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{s.size}</span>
          <select name="size" className={inputCls + " appearance-none"}>
            {sizes.length === 0 ? (
              <option value="">{s.sizeNotApplicable}</option>
            ) : (
              sizes.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))
            )}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelCls}>{s.notes}</span>
        <textarea
          name="notes"
          rows={3}
          placeholder={s.notesPlaceholder}
          className={inputCls + " py-2 h-auto resize-y min-h-[88px]"}
        />
      </label>

      {status === "error" && error && (
        <div className="flex items-start gap-2 text-sm text-red-400">
          <WarningCircleIcon className="size-4 shrink-0 mt-0.5" weight="bold" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-sm bg-[color:var(--accent)] text-black font-mono text-xs uppercase tracking-[0.18em] font-bold hover:bg-[color:var(--accent-hard)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        <PaperPlaneTiltIcon className="size-4" weight="bold" />
        {status === "submitting" ? "..." : s.submit}
      </button>
    </form>
  );
}
