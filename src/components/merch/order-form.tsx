"use client";

import { useState, useRef } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import {
  PaperPlaneTiltIcon,
  CheckCircleIcon,
  ImageSquareIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";

import { discordDisplayName, useClientSession } from "@/lib/use-session";

type Attachment = { mimeType: string; data: string };

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

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
  const [photos, setPhotos] = useState<Attachment[]>([]);
  const captchaRef = useRef<HCaptcha>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { session } = useClientSession();

  function attach(list: FileList | null) {
    if (!list) return;
    for (const f of Array.from(list).slice(0, MAX_PHOTOS - photos.length)) {
      if (!PHOTO_MIMES.includes(f.type) || f.size > MAX_PHOTO_BYTES) {
        setError(s.photoTooBig || "Фото має бути JPG/PNG/WebP/GIF до 2 МБ");
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result || "").split(",")[1];
        if (!base64) return;
        setPhotos((p) =>
          p.length >= MAX_PHOTOS ? p : [...p, { mimeType: f.type, data: base64 }],
        );
      };
      reader.readAsDataURL(f);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const discordPrefill = session ? `${session.username}${session.id ? ` (${session.id})` : ""}` : "";
  const callsignPrefill = discordDisplayName(session) || "";

  // Only show hCaptcha when a real sitekey is configured. The 1000...0001 key
  // is hCaptcha's public test key — it renders a confusing red "test" warning,
  // so in dev / no-key setups we skip the widget and lean on rate-limiting.
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY || "";
  const captchaOn = siteKey.length > 0 && !siteKey.startsWith("10000000");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (captchaOn && !captchaToken) {
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
    if (photos.length) payload.images = photos;

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

      <div className="flex flex-col gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={PHOTO_MIMES.join(",")}
          multiple
          hidden
          onChange={(e) => attach(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={photos.length >= MAX_PHOTOS}
          className="inline-flex items-center gap-2 h-11 px-3 rounded-sm border border-dashed border-[color:var(--border-strong)] text-sm text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 disabled:opacity-40"
        >
          <ImageSquareIcon className="size-5" weight="bold" />
          {s.attachPhotos || "Прикріпити фото (до 3 шт, по 2 МБ)"}
        </button>
        {photos.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {photos.map((img, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${img.mimeType};base64,${img.data}`}
                  alt=""
                  className="size-16 object-cover rounded-sm border border-[color:var(--border-strong)]"
                />
                <button
                  type="button"
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-black border border-[color:var(--border-strong)] flex items-center justify-center text-[color:var(--muted-2)] hover:text-red-400"
                >
                  <XIcon className="size-3" weight="bold" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {captchaOn && (
        <div className="flex justify-center">
          <HCaptcha
            sitekey={siteKey}
            onVerify={setCaptchaToken}
            ref={captchaRef}
            theme="dark"
          />
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button type="submit" disabled={status === "submitting" || (captchaOn && !captchaToken)} className="bg-[color:var(--accent)] text-black p-3 font-bold uppercase tracking-widest hover:bg-[color:var(--accent-hard)] transition-colors disabled:opacity-50">
        {status === "submitting" ? "Отправка..." : s.submit}
      </button>
    </form>
  );
}
