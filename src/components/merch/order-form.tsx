"use client";

import { useState, useRef } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import {
  PaperPlaneTiltIcon,
  CheckCircleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import { discordDisplayName, useClientSession } from "@/lib/use-session";

export function OrderForm({
  itemKey,
  title,
  price,
  sizes,
  strings: s,
}: any) {
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);
  const { session } = useClientSession();

  const discordPrefill = session ? `${session.username}${session.id ? ` (${session.id})` : ""}` : "";
  const callsignPrefill = discordDisplayName(session) || "";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!captchaToken) {
      setError("Подтвердите, что вы человек!");
      return;
    }

    setStatus("submitting");
    setError(null);
    const fd = new FormData(e.currentTarget);

    const payload: any = {
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
      captchaToken,
    };

    try {
      const res = await fetch("/api/merch/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Ошибка сервера: ${res.status}`);
      }
      setStatus("ok");
    } catch (err: any) {
      setStatus("error");
      setError(err.message);
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-sm border border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)] p-6 flex flex-col gap-3">
        <CheckCircleIcon className="size-10 text-[color:var(--accent)]" weight="duotone" />
        <h2 className="text-xl font-bold">{s.successTitle}</h2>
        <p className="text-sm text-[color:var(--muted-2)]">{s.successBody}</p>
      </div>
    );
  }

  const inputCls = "h-11 px-3 rounded-sm bg-[color:var(--background)] border border-[color:var(--border-strong)] focus:border-[color:var(--accent)] focus:outline-none text-sm";

  return (
    <form onSubmit={onSubmit} className="rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--background-elev)] p-6 flex flex-col gap-5">
      <h2 className="text-2xl font-bold">{s.formTitle}</h2>

      <input name="discord" defaultValue={discordPrefill} required placeholder={s.discordPlaceholder} className={inputCls} />
      <input name="phone" required placeholder={s.phonePlaceholder} className={inputCls} />
      <input name="city" required placeholder={s.cityPlaceholder} className={inputCls} />

      <div className="flex justify-center">
        <HCaptcha
          sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY || "10000000-ffff-ffff-ffff-000000000001"}
          onVerify={setCaptchaToken}
          ref={captchaRef}
          theme="dark"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button type="submit" disabled={status === "submitting" || !captchaToken} className="bg-[color:var(--accent)] text-black p-3 font-bold uppercase tracking-widest hover:bg-[color:var(--accent-hard)] transition-colors disabled:opacity-50">
        {status === "submitting" ? "Отправка..." : s.submit}
      </button>
    </form>
  );
}
