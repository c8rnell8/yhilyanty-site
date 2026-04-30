"use client";

import { useRef, useState } from "react";
import {
  ArrowCounterClockwiseIcon,
  CircleNotchIcon,
  ImageIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react";

import { Link } from "@/i18n/navigation";
import type { ImageSlot } from "@/lib/cms/slots";

export function ImageManager({
  slots,
  initialOverrides,
}: {
  slots: ImageSlot[];
  initialOverrides: Record<string, string>;
}) {
  const [overrides, setOverrides] =
    useState<Record<string, string>>(initialOverrides);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function upload(slot: string, file: File) {
    setBusy(slot);
    setErr((p) => ({ ...p, [slot]: "" }));
    const fd = new FormData();
    fd.append("key", slot);
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/images", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const j = await res.json();
      setOverrides((p) => ({ ...p, [slot]: j.url }));
      setSavedAt((p) => ({ ...p, [slot]: Date.now() }));
    } catch (e) {
      setErr((p) => ({
        ...p,
        [slot]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setBusy((cur) => (cur === slot ? null : cur));
    }
  }

  async function reset(slot: string) {
    setBusy(slot);
    setErr((p) => ({ ...p, [slot]: "" }));
    try {
      const res = await fetch(
        `/api/admin/images?key=${encodeURIComponent(slot)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setOverrides((p) => {
        const c = { ...p };
        delete c[slot];
        return c;
      });
      setSavedAt((p) => ({ ...p, [slot]: Date.now() }));
    } catch (e) {
      setErr((p) => ({
        ...p,
        [slot]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setBusy((cur) => (cur === slot ? null : cur));
    }
  }

  const groups = Array.from(new Set(slots.map((s) => s.area)));

  return (
    <section className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-12 lg:py-16">
      <div className="flex flex-col gap-2 mb-8">
        <Link
          href="/admin"
          className="tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)]"
        >
          ← АДМІН-ПАНЕЛЬ
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Менеджер зображень
        </h1>
        <p className="text-sm text-[color:var(--muted-2)] max-w-2xl">
          Кожен слот = картинка на сайті. Заливаєш нове зображення — воно
          відразу заміняє старе на всіх сторінках. Reset повертає базове.
          Підтримуються JPG / PNG / WebP / GIF до 10 MB.
        </p>
      </div>

      {groups.map((area) => {
        const areaSlots = slots.filter((s) => s.area === area);
        return (
          <div key={area} className="mb-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="tactical-text text-[color:var(--accent)]">
                {area.toUpperCase()}
              </span>
              <span className="tactical-text text-[color:var(--muted)]">
                · {areaSlots.length} слот(ів)
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {areaSlots.map((slot) => {
                const url = overrides[slot.key] || slot.default;
                const isOverridden = !!overrides[slot.key];
                const justSaved =
                  savedAt[slot.key] && Date.now() - savedAt[slot.key] < 2500;
                return (
                  <div
                    key={slot.key}
                    className={`rounded-sm border bg-[color:var(--background-elev)] overflow-hidden flex flex-col ${
                      isOverridden
                        ? "border-[color:var(--accent)]/60"
                        : "border-[color:var(--border-strong)]"
                    }`}
                  >
                    <div
                      className="relative bg-black"
                      style={{ aspectRatio: slot.aspect || "4 / 3" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url + (isOverridden ? `?t=${savedAt[slot.key] || 0}` : "")}
                        alt={slot.label}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 right-2 flex justify-between gap-2">
                        <span className="tactical-text text-[color:var(--accent)] bg-black/60 backdrop-blur-sm px-2 py-1 rounded-sm">
                          {slot.key}
                        </span>
                        {isOverridden && (
                          <span className="tactical-text text-black bg-[color:var(--accent)] px-2 py-1 rounded-sm">
                            CUSTOM
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-4 flex flex-col gap-3 flex-1">
                      <div className="flex items-center gap-2">
                        <ImageIcon
                          className="size-4 text-[color:var(--muted-2)]"
                          weight="bold"
                        />
                        <span className="font-bold text-sm">{slot.label}</span>
                      </div>
                      {err[slot.key] && (
                        <span className="tactical-text text-[10px] inline-flex items-center gap-1 text-red-400">
                          <WarningCircleIcon className="size-3" weight="fill" />
                          {err[slot.key]}
                        </span>
                      )}
                      {justSaved && (
                        <span className="tactical-text text-[10px] inline-flex items-center gap-1 text-emerald-300">
                          <CheckCircleIcon className="size-3" weight="fill" />
                          ЗБЕРЕЖЕНО
                        </span>
                      )}
                      <input
                        ref={(el) => {
                          inputs.current[slot.key] = el;
                        }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) upload(slot.key, f);
                          e.target.value = "";
                        }}
                      />
                      <div className="grid grid-cols-2 gap-2 mt-auto">
                        <button
                          type="button"
                          onClick={() => inputs.current[slot.key]?.click()}
                          disabled={busy === slot.key}
                          className="tactical-text inline-flex items-center justify-center gap-2 px-3 h-9 rounded-sm bg-[color:var(--accent)] text-black font-bold hover:bg-[color:var(--accent-hard)] disabled:opacity-50"
                        >
                          {busy === slot.key ? (
                            <CircleNotchIcon
                              className="size-3.5 animate-spin"
                              weight="bold"
                            />
                          ) : (
                            <UploadSimpleIcon className="size-3.5" weight="bold" />
                          )}
                          UPLOAD
                        </button>
                        <button
                          type="button"
                          onClick={() => reset(slot.key)}
                          disabled={!isOverridden || busy === slot.key}
                          className="tactical-text inline-flex items-center justify-center gap-2 px-3 h-9 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowCounterClockwiseIcon
                            className="size-3.5"
                            weight="bold"
                          />
                          RESET
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="mt-6 text-xs text-[color:var(--muted)] tactical-text">
        TIP: щоб додати нову позицію на сайті як «змінювану картинку» — додай
        запис у{" "}
        <code className="font-mono">src/lib/cms/slots.ts</code> з ключем,
        дефолтним шляхом і label-ом.
      </p>
    </section>
  );
}
