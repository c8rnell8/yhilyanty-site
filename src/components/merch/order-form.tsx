"use client";

import { useRef, useState } from "react";
import {
  PaperPlaneTiltIcon,
  CheckCircleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

import { discordDisplayName, useClientSession } from "@/lib/use-session";

const HCAPTCHA_SITEKEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY || "";

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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha | null>(null);
  const { session } = useClientSession();
  const discordPrefill = session
    ? `${session.username}${session.id ? ` (${session.id})` : ""}`
    : "";
  const callsignPrefill = discordDisplayName(session) || "";

  const captchaEnabled = Boolean(HCAPTCHA_SITEKEY);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (captchaEnabled && !captchaToken) {
      setStatus("error");
      setError("\u041f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438, \u0449\u043e \u0442\u0438 \u043b\u044e\u0434\u0438\u043d\u0430 (\u043f\u0440\u043e\u0439\u0434\u0438 captcha \u0432\u0438\u0449\u0435)");
      return;
    }
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
      captchaToken: captchaToken || undefined,
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
      // hCaptcha tokens are single-use; reset so user can retry.
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
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
          key={`discord-${discordPrefill}`}
          name="discord"
          required
          defaultValue={discordPrefill}
          placeholder={s.discordPlaceholder}
          className={inputCls}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>{s.callsign}</span>
          <input
            key={`callsign-${callsignPrefill}`}
            name="callsign"
            defaultValue={callsignPrefill}
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

      {captchaEnabled && (
        <div className="flex justify-center">
          <HCaptcha
            sitekey={HCAPTCHA_SITEKEY}
            onVerify={(t) => setCaptchaToken(t)}
            onExpire={() => setCaptchaToken(null)}
            onError={() => setCaptchaToken(null)}
            theme="dark"
            ref={captchaRef}
          />
        </div>
      )}

      {status === "error" && error && (
        <div className="flex items-start gap-2 text-sm text-red-400">
          <WarningCircleIcon className="size-4 shrink-0 mt-0.5" weight="bold" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={status === "submitting" || (captchaEnabled && !captchaToken)}
        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-sm bg-[color:var(--accent)] text-black font-mono text-xs uppercase tracking-[0.18em] font-bold hover:bg-[color:var(--accent-hard)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        <PaperPlaneTiltIcon className="size-4" weight="bold" />
        {status === "submitting" ? "..." : s.submit}
      </button>
    </form>
  );
}
