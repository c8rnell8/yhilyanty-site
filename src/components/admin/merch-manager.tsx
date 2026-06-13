"use client";

import {
  CircleNotchIcon,
  ImageSquareIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import type { MerchProduct } from "@/lib/cms/store";

const STR = {
  ua: {
    back: "← АДМІН-ПАНЕЛЬ", title: "Товари мерчу",
    subtitle: "Додавай товари, став ціну, опис трьома мовами, розміри і до 5 медіа (фото, гіф, відео). Порожній список — на сайті показуються 3 стандартні товари.",
    add: "Додати товар", save: "Зберегти", del: "Видалити", cancel: "Скасувати",
    name: "Назва", price: "Ціна", desc: "Опис", sizes: "Розміри (через кому)",
    media: "Медіа (до 5: фото / гіф / відео)", addMedia: "Додати файл",
    urlPrompt: "Встав посилання на фото/відео (або завантаж через Медіатеку):",
    delConfirm: "Видалити цей товар?", empty: "Товарів ще немає. Натисни «Додати товар».",
    lang: "Мова картки", translate: "Перекласти на інші мови",
  },
  ru: {
    back: "← АДМИН-ПАНЕЛЬ", title: "Товары мерча",
    subtitle: "Добавляй товары, ставь цену, описание на трёх языках, размеры и до 5 медиа (фото, гиф, видео). Пустой список — на сайте показываются 3 стандартных товара.",
    add: "Добавить товар", save: "Сохранить", del: "Удалить", cancel: "Отмена",
    name: "Название", price: "Цена", desc: "Описание", sizes: "Размеры (через запятую)",
    media: "Медиа (до 5: фото / гиф / видео)", addMedia: "Добавить файл",
    urlPrompt: "Вставь ссылку на фото/видео (или загрузи через Медиатеку):",
    delConfirm: "Удалить этот товар?", empty: "Товаров ещё нет. Нажми «Добавить товар».",
    lang: "Язык карточки", translate: "Перевести на другие языки",
  },
  en: {
    back: "← ADMIN PANEL", title: "Merch products",
    subtitle: "Add products, set price, description in three languages, sizes and up to 5 media (photo, gif, video). Empty list — the site shows the 3 default items.",
    add: "Add product", save: "Save", del: "Delete", cancel: "Cancel",
    name: "Name", price: "Price", desc: "Description", sizes: "Sizes (comma-separated)",
    media: "Media (up to 5: photo / gif / video)", addMedia: "Add file",
    urlPrompt: "Paste a photo/video link (or upload via the Media library):",
    delConfirm: "Delete this product?", empty: "No products yet. Hit “Add product”.",
    lang: "Card language", translate: "Translate to other languages",
  },
} as const;

type Lang = "ua" | "ru" | "en";

function blank(): MerchProduct {
  return { id: "", title: {}, desc: {}, price: "", sizes: [], media: [], createdAt: 0 };
}

export function MerchManager({
  locale,
  initial,
}: {
  locale: string;
  initial: MerchProduct[];
}) {
  const t = STR[locale as keyof typeof STR] || STR.ua;
  const [products, setProducts] = useState(initial);
  const [editing, setEditing] = useState<MerchProduct | null>(null);
  const [lang, setLang] = useState<Lang>(locale as Lang);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startNew() {
    setEditing(blank());
    setLang(locale as Lang);
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/merch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setProducts(j.store.products);
      setEditing(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t.delConfirm)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/merch?id=${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (res.ok) setProducts(j.store.products);
    } finally {
      setBusy(false);
    }
  }

  async function uploadMedia(file: File) {
    if (!editing) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/media", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setEditing((p) => (p ? { ...p, media: [...p.media, j.url].slice(0, 5) } : p));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function translateCard() {
    if (!editing) return;
    setBusy(true);
    setErr(null);
    try {
      const items: Record<string, string> = {};
      if (editing.title[lang]) items["t"] = editing.title[lang]!;
      if (editing.desc[lang]) items["d"] = editing.desc[lang]!;
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: lang,
          to: (["ua", "ru", "en"] as Lang[]).filter((l) => l !== lang),
          items,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setEditing((p) => {
        if (!p) return p;
        const title = { ...p.title };
        const desc = { ...p.desc };
        for (const [lc, vals] of Object.entries(j.translations || {})) {
          const v = vals as Record<string, string>;
          if (v.t) title[lc as Lang] = v.t;
          if (v.d) desc[lc as Lang] = v.d;
        }
        return { ...p, title, desc };
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const isVideo = (u: string) => /\.(mp4|webm)$/i.test(u);

  return (
    <section className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-10 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div className="flex flex-col gap-2">
          <Link href="/admin" className="tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)]">
            {t.back}
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-[color:var(--muted-2)] max-w-2xl">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="tactical-text inline-flex items-center gap-2 px-4 h-11 rounded-sm bg-[color:var(--accent)] text-black font-bold hover:bg-[color:var(--accent-hard)]"
        >
          <PlusIcon className="size-4" weight="bold" />
          {t.add}
        </button>
      </div>

      {err && (
        <div className="mb-6 px-4 py-3 rounded-sm border border-red-500/40 bg-red-500/10 text-red-300 text-sm">
          {err}
        </div>
      )}

      {products.length === 0 && !editing && (
        <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-8 text-center text-[color:var(--muted-2)] text-sm">
          {t.empty}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {products.map((p) => (
          <div key={p.id} className="rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--background-elev)] overflow-hidden flex flex-col">
            <div className="relative bg-black aspect-[3/2]">
              {p.media[0] ? (
                isVideo(p.media[0]) ? (
                  <video src={p.media[0]} className="absolute inset-0 w-full h-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.media[0]} alt="" className="absolute inset-0 w-full h-full object-cover" />
                )
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[color:var(--muted)]">
                  <ImageSquareIcon className="size-8" weight="bold" />
                </div>
              )}
            </div>
            <div className="p-4 flex flex-col gap-2 flex-1">
              <h3 className="font-bold">{p.title[locale as Lang] || p.title.ua || "—"}</h3>
              <span className="font-mono text-xs text-[color:var(--accent)]">{p.price}</span>
              <div className="grid grid-cols-2 gap-2 mt-auto">
                <button type="button" onClick={() => { setEditing(p); setLang(locale as Lang); }} className="tactical-text h-8 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40">
                  {t.save.toUpperCase() === "SAVE" ? "EDIT" : "✎"}
                </button>
                <button type="button" onClick={() => remove(p.id)} className="tactical-text h-8 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-rose-300 hover:border-rose-500/40 inline-flex items-center justify-center gap-1">
                  <TrashIcon className="size-3.5" weight="bold" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="rounded-sm border border-[color:var(--accent)]/40 bg-[color:var(--background-elev)] p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="tactical-text text-[color:var(--muted-2)]">{t.lang}:</span>
            {(["ua", "ru", "en"] as Lang[]).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} className={`px-3 h-8 rounded-sm border tactical-text ${lang === l ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]" : "border-[color:var(--border-strong)] text-[color:var(--muted-2)]"}`}>
                {l.toUpperCase()}
              </button>
            ))}
            <button type="button" onClick={translateCard} disabled={busy} className="tactical-text ml-auto px-3 h-8 rounded-sm border border-[color:var(--accent)]/40 text-[color:var(--accent)] hover:bg-[color:var(--accent-soft)] disabled:opacity-50">
              {t.translate}
            </button>
          </div>

          <label className="flex flex-col gap-1">
            <span className="tactical-text text-[color:var(--muted-2)]">{t.name} ({lang.toUpperCase()})</span>
            <input
              value={editing.title[lang] || ""}
              onChange={(e) => setEditing((p) => (p ? { ...p, title: { ...p.title, [lang]: e.target.value } } : p))}
              className="h-11 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm focus:outline-none focus:border-[color:var(--accent)]"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="tactical-text text-[color:var(--muted-2)]">{t.price}</span>
              <input
                value={editing.price}
                onChange={(e) => setEditing((p) => (p ? { ...p, price: e.target.value } : p))}
                placeholder="350 ₴"
                className="h-11 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm focus:outline-none focus:border-[color:var(--accent)]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="tactical-text text-[color:var(--muted-2)]">{t.sizes}</span>
              <input
                value={editing.sizes.join(", ")}
                onChange={(e) => setEditing((p) => (p ? { ...p, sizes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : p))}
                placeholder="S, M, L, XL"
                className="h-11 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm focus:outline-none focus:border-[color:var(--accent)]"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="tactical-text text-[color:var(--muted-2)]">{t.desc} ({lang.toUpperCase()})</span>
            <textarea
              value={editing.desc[lang] || ""}
              onChange={(e) => setEditing((p) => (p ? { ...p, desc: { ...p.desc, [lang]: e.target.value } } : p))}
              rows={3}
              className="px-3 py-2 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm focus:outline-none focus:border-[color:var(--accent)] resize-y"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="tactical-text text-[color:var(--muted-2)]">{t.media}</span>
            <div className="flex gap-2 flex-wrap">
              {editing.media.map((m, i) => (
                <div key={i} className="relative">
                  {isVideo(m) ? (
                    <video src={m} className="size-20 object-cover rounded-sm border border-[color:var(--border-strong)]" muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m} alt="" className="size-20 object-cover rounded-sm border border-[color:var(--border-strong)]" />
                  )}
                  <button type="button" onClick={() => setEditing((p) => (p ? { ...p, media: p.media.filter((_, j) => j !== i) } : p))} className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-black border border-[color:var(--border-strong)] flex items-center justify-center text-[color:var(--muted-2)] hover:text-rose-300">
                    <XIcon className="size-3" weight="bold" />
                  </button>
                </div>
              ))}
              {editing.media.length < 5 && (
                <label className="size-20 rounded-sm border border-dashed border-[color:var(--border-strong)] flex items-center justify-center cursor-pointer text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40">
                  <input type="file" accept="image/*,video/mp4,video/webm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMedia(f); }} />
                  <PlusIcon className="size-6" weight="bold" />
                </label>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setEditing(null)} className="tactical-text px-4 h-10 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)]">
              {t.cancel}
            </button>
            <button type="button" onClick={save} disabled={busy} className="tactical-text px-5 h-10 rounded-sm bg-[color:var(--accent)] text-black font-bold hover:bg-[color:var(--accent-hard)] disabled:opacity-50 inline-flex items-center gap-2">
              {busy && <CircleNotchIcon className="size-4 animate-spin" weight="bold" />}
              {t.save}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
