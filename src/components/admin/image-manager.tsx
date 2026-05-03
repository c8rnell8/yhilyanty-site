"use client";

import { useRef, useState } from "react";
import {
  ArrowCounterClockwiseIcon,
  CircleNotchIcon,
  ImageIcon,
  PlusIcon,
  TrashIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react";

import { Link } from "@/i18n/navigation";
import type { ImageSlot } from "@/lib/cms/slots";

const MAX_PHOTOS = 5;

export function ImageManager({
  slots,
  initialOverrides,
}: {
  slots: ImageSlot[];
  // string[] (multi) or string (legacy single) — both shapes accepted on hydration
  initialOverrides: Record<string, string | string[]>;
}) {
  const normalize = (
    raw: Record<string, string | string[]>
  ): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (Array.isArray(v)) out[k] = v.slice(0, MAX_PHOTOS);
      else if (typeof v === "string" && v) out[k] = [v];
    }
    return out;
  };
  const [overrides, setOverrides] = useState<Record<string, string[]>>(
    normalize(initialOverrides)
  );
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
    fd.append("mode", "append");
    try {
      const res = await fetch("/api/admin/images", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as {
        photos?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setOverrides((p) => ({ ...p, [slot]: j.photos || [] }));
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

  async function removeAt(slot: string, index: number) {
    setBusy(slot);
    setErr((p) => ({ ...p, [slot]: "" }));
    try {
      const res = await fetch(
        `/api/admin/images?key=${encodeURIComponent(slot)}&index=${index}`,
        { method: "DELETE" }
      );
      const j = (await res.json().catch(() => ({}))) as {
        photos?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setOverrides((p) => {
        const c = { ...p };
        if ((j.photos || []).length === 0) delete c[slot];
        else c[slot] = j.photos as string[];
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

  async function resetAll(slot: string) {
    setBusy(slot);
    setErr((p) => ({ ...p, [slot]: "" }));
    try {
      const res = await fetch(
        `/api/admin/images?key=${encodeURIComponent(slot)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
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
        <p className="text-sm text-[color:var(--muted-2)] max-w-3xl">
          Кожен слот = до {MAX_PHOTOS} фото на сайті. Натискай <b>+</b> щоб
          додати, кошик — щоб видалити окремий кадр, RESET — щоб повернути все
          до базового. Підтримуються JPG / PNG / WebP / GIF до 10 MB.
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
                const photos = overrides[slot.key] || [];
                const hero = photos[0] || slot.default;
                const isOverridden = photos.length > 0;
                const isFull = photos.length >= MAX_PHOTOS;
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
                        src={hero + (isOverridden ? `?t=${savedAt[slot.key] || 0}` : "")}
                        alt={slot.label}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 right-2 flex justify-between gap-2">
                        <span className="tactical-text text-[color:var(--accent)] bg-black/60 backdrop-blur-sm px-2 py-1 rounded-sm">
                          {slot.key}
                        </span>
                        <span className="tactical-text text-white bg-black/60 backdrop-blur-sm px-2 py-1 rounded-sm">
                          {photos.length}/{MAX_PHOTOS}
                        </span>
                      </div>
                    </div>

                    {/* Photo strip */}
                    <div className="px-3 pt-3">
                      <div className="grid grid-cols-5 gap-1.5">
                        {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
                          const url = photos[i];
                          if (url) {
                            return (
                              <div
                                key={i}
                                className="relative aspect-square rounded-sm overflow-hidden border border-[color:var(--border)] group"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url + `?t=${savedAt[slot.key] || 0}`}
                                  alt=""
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeAt(slot.key, i)}
                                  disabled={busy === slot.key}
                                  className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/70 opacity-0 hover:opacity-100 transition disabled:cursor-not-allowed"
                                  aria-label={`Видалити фото ${i + 1}`}
                                >
                                  <TrashIcon className="size-4 text-red-400" weight="bold" />
                                </button>
                              </div>
                            );
                          }
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => inputs.current[slot.key]?.click()}
                              disabled={busy === slot.key}
                              className="aspect-square rounded-sm border border-dashed border-[color:var(--border-strong)] flex items-center justify-center text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/50 disabled:opacity-40"
                              aria-label="Додати фото"
                            >
                              <PlusIcon className="size-4" weight="bold" />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-3 flex flex-col gap-2 flex-1">
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
                          disabled={busy === slot.key || isFull}
                          className="tactical-text inline-flex items-center justify-center gap-2 px-3 h-9 rounded-sm bg-[color:var(--accent)] text-black font-bold hover:bg-[color:var(--accent-hard)] disabled:opacity-50"
                          title={isFull ? `Максимум ${MAX_PHOTOS} фото` : "Додати фото"}
                        >
                          {busy === slot.key ? (
                            <CircleNotchIcon
                              className="size-3.5 animate-spin"
                              weight="bold"
                            />
                          ) : (
                            <UploadSimpleIcon className="size-3.5" weight="bold" />
                          )}
                          {isFull ? "FULL" : photos.length === 0 ? "UPLOAD" : "+ ADD"}
                        </button>
                        <button
                          type="button"
                          onClick={() => resetAll(slot.key)}
                          disabled={!isOverridden || busy === slot.key}
                          className="tactical-text inline-flex items-center justify-center gap-2 px-3 h-9 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowCounterClockwiseIcon
                            className="size-3.5"
                            weight="bold"
                          />
                          RESET ALL
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
    </section>
  );
}
