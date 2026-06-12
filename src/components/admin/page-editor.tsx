"use client";

import {
  ArrowDownIcon,
  ArrowSquareOutIcon,
  ArrowUpIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  DotsSixVerticalIcon,
  ImageIcon,
  ImagesIcon,
  MinusIcon,
  PlusIcon,
  TextAlignLeftIcon,
  TextTIcon,
  TrashIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Link } from "@/i18n/navigation";
import type { Block, Multi, PageDoc } from "@/lib/cms/store";

type Locale = "ua" | "ru" | "en";
const LOCALES: Locale[] = ["ua", "ru", "en"];

function genId(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6)
  );
}

const BLOCK_META: Record<
  Block["type"],
  { label: string; icon: React.ComponentType<{ className?: string; weight?: "bold" | "fill" | "regular" }> }
> = {
  "hero-lite": { label: "Шапка (Hero)", icon: TextTIcon },
  "rich-text": { label: "Текст / Параграф", icon: TextAlignLeftIcon },
  cta: { label: "CTA-кнопка", icon: ArrowSquareOutIcon },
  image: { label: "Зображення", icon: ImageIcon },
  gallery: { label: "Галерея", icon: ImagesIcon },
  divider: { label: "Розділювач", icon: MinusIcon },
};

function createBlock(type: Block["type"]): Block {
  const id = genId();
  switch (type) {
    case "hero-lite":
      return { id, type, eyebrow: {}, title: {}, body: {} };
    case "rich-text":
      return { id, type, body: {} };
    case "cta":
      return { id, type, label: {}, href: "", variant: "primary" };
    case "image":
      return { id, type, src: "", alt: "", caption: {} };
    case "gallery":
      return { id, type, items: [] };
    case "divider":
      return { id, type };
  }
}

export function PageEditor({ initialPage }: { initialPage: PageDoc }) {
  const router = useRouter();
  const [page, setPage] = useState<PageDoc>(initialPage);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const update = (patch: Partial<PageDoc>) => setPage((p) => ({ ...p, ...patch }));
  const updateTitle = (locale: Locale, value: string) =>
    update({ title: { ...page.title, [locale]: value } });

  const updateBlock = (id: string, patch: Partial<Block>) =>
    setPage((p) => ({
      ...p,
      blocks: p.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)),
    }));

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const next = [...page.blocks];
    const t = idx + dir;
    if (t < 0 || t >= next.length) return;
    [next[idx], next[t]] = [next[t], next[idx]];
    update({ blocks: next });
  };

  const removeBlock = (id: string) => {
    if (!confirm("Видалити цей блок?")) return;
    update({ blocks: page.blocks.filter((b) => b.id !== id) });
  };

  const addBlock = (type: Block["type"]) => {
    update({ blocks: [...page.blocks, createBlock(type)] });
    setAddOpen(false);
  };

  async function uploadOne(key: string, file: File): Promise<string> {
    const fd = new FormData();
    fd.append("key", key);
    fd.append("file", file);
    const res = await fetch("/api/admin/images", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
    return j.url as string;
  }

  async function uploadImageForBlock(blockId: string, kind: "image" | "gallery-item", galleryItemId?: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    // Galleries take a whole batch at once: the first file lands in the
    // clicked tile, the rest become new tiles.
    input.multiple = kind === "gallery-item";
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (files.length === 0) return;
      setUploadingId(blockId + (galleryItemId || ""));
      setErr(null);
      try {
        if (kind === "image") {
          // key = block-scoped, uniqueness avoids overwriting other slots
          const url = await uploadOne(`pages.${page.id}.${blockId}`, files[0]);
          updateBlock(blockId, { src: url } as Partial<Block>);
        } else if (kind === "gallery-item" && galleryItemId) {
          const replaceUrl = await uploadOne(
            `pages.${page.id}.${blockId}.${galleryItemId}`,
            files[0],
          );
          const extra: { id: string; src: string }[] = [];
          for (const f of files.slice(1)) {
            const id = genId();
            extra.push({
              id,
              src: await uploadOne(`pages.${page.id}.${blockId}.${id}`, f),
            });
          }
          setPage((p) => ({
            ...p,
            blocks: p.blocks.map((b) =>
              b.id === blockId && b.type === "gallery"
                ? {
                    ...b,
                    items: [
                      ...b.items.map((it) =>
                        it.id === galleryItemId ? { ...it, src: replaceUrl } : it,
                      ),
                      ...extra,
                    ],
                  }
                : b,
            ),
          }));
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setUploadingId(null);
      }
    };
    input.click();
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: page.id,
          slug: page.slug,
          title: page.title,
          blocks: page.blocks,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setSaved(true);
      setPage(j.page);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // Drag-drop handlers
  const onDragStart = (key: string) => (e: React.DragEvent) => {
    setDragKey(key);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", key);
  };
  const onDragOver = (key: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverKey !== key) setDragOverKey(key);
  };
  const onDragLeave = () => setDragOverKey(null);
  const onDrop = (targetKey: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const srcKey = dragKey || e.dataTransfer.getData("text/plain");
    setDragKey(null);
    setDragOverKey(null);
    if (!srcKey || srcKey === targetKey) return;
    setPage((p) => {
      const si = p.blocks.findIndex((b) => b.id === srcKey);
      const ti = p.blocks.findIndex((b) => b.id === targetKey);
      if (si === -1 || ti === -1) return p;
      const next = [...p.blocks];
      const [moved] = next.splice(si, 1);
      next.splice(ti, 0, moved);
      return { ...p, blocks: next };
    });
  };
  const onDragEnd = () => {
    setDragKey(null);
    setDragOverKey(null);
  };

  return (
    <section className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-10 py-10">
      <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
        <div className="flex flex-col gap-2 min-w-0">
          <Link
            href="/admin/pages"
            className="tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)]"
          >
            ← СТОРІНКИ
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Редагування сторінки
          </h1>
          <a
            href={`/ua/p/${page.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tactical-text text-[color:var(--accent)] hover:text-[color:var(--accent-hard)] inline-flex items-center gap-1.5 w-fit"
          >
            /p/{page.slug} <ArrowSquareOutIcon className="size-3.5" weight="bold" />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="tactical-text inline-flex items-center gap-2 px-4 h-10 rounded-sm bg-[color:var(--accent)] text-black font-bold hover:bg-[color:var(--accent-hard)] disabled:opacity-50"
          >
            {busy ? (
              <CircleNotchIcon className="size-4 animate-spin" weight="bold" />
            ) : (
              <CheckCircleIcon className="size-4" weight="bold" />
            )}
            ЗБЕРЕГТИ
          </button>
        </div>
      </div>

      {saved && (
        <div className="mb-4 px-4 py-2 rounded-sm border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 tactical-text inline-flex items-center gap-2">
          <CheckCircleIcon className="size-4" weight="fill" />
          СТОРІНКУ ЗБЕРЕЖЕНО
        </div>
      )}
      {err && (
        <div className="mb-4 px-4 py-2 rounded-sm border border-red-500/40 bg-red-500/10 text-red-300 tactical-text inline-flex items-center gap-2">
          <WarningCircleIcon className="size-4" weight="fill" />
          {err}
        </div>
      )}

      {/* Meta */}
      <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-5 mb-6">
        <h2 className="text-sm font-mono uppercase tracking-[0.14em] text-[color:var(--accent)] mb-4">
          Мета
        </h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--muted)]">
              SLUG (URL)
            </span>
            <input
              value={page.slug}
              onChange={(e) => update({ slug: e.target.value })}
              className="h-10 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] font-mono text-sm focus:border-[color:var(--accent)] outline-none"
            />
          </label>
          {LOCALES.map((lc) => (
            <label key={lc} className="flex flex-col gap-1">
              <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--muted)]">
                Заголовок · {lc.toUpperCase()}
              </span>
              <input
                value={page.title[lc] || ""}
                onChange={(e) => updateTitle(lc, e.target.value)}
                className="h-10 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm focus:border-[color:var(--accent)] outline-none"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Blocks */}
      <div className="flex flex-col gap-3">
        {page.blocks.map((b, idx) => {
          const Meta = BLOCK_META[b.type];
          const isDragging = dragKey === b.id;
          const isDragOver = dragOverKey === b.id && dragKey && dragKey !== b.id;
          return (
            <div
              key={b.id}
              draggable
              onDragStart={onDragStart(b.id)}
              onDragOver={onDragOver(b.id)}
              onDragLeave={onDragLeave}
              onDrop={onDrop(b.id)}
              onDragEnd={onDragEnd}
              className={`rounded-sm border bg-[color:var(--background-elev)] transition-colors ${
                isDragging
                  ? "border-[color:var(--accent)]/60 opacity-60"
                  : isDragOver
                    ? "border-[color:var(--accent)]"
                    : "border-[color:var(--border)]"
              }`}
            >
              <header className="flex items-center gap-2 px-4 h-11 border-b border-[color:var(--border)]">
                <span
                  className="shrink-0 size-6 inline-flex items-center justify-center text-[color:var(--muted)] cursor-grab active:cursor-grabbing"
                  aria-hidden
                >
                  <DotsSixVerticalIcon className="size-4" weight="bold" />
                </span>
                <Meta.icon
                  className="size-4 text-[color:var(--accent)]"
                  weight="bold"
                />
                <span className="text-sm font-bold">{Meta.label}</span>
                <span className="font-mono text-[10px] text-[color:var(--muted)]">
                  · {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveBlock(idx, -1)}
                    disabled={idx === 0}
                    className="size-8 inline-flex items-center justify-center rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 disabled:opacity-30"
                    title="Вище"
                  >
                    <ArrowUpIcon className="size-4" weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(idx, 1)}
                    disabled={idx === page.blocks.length - 1}
                    className="size-8 inline-flex items-center justify-center rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 disabled:opacity-30"
                    title="Нижче"
                  >
                    <ArrowDownIcon className="size-4" weight="bold" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBlock(b.id)}
                    className="size-8 inline-flex items-center justify-center rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-rose-300 hover:border-rose-500/40"
                    title="Видалити"
                  >
                    <TrashIcon className="size-4" weight="bold" />
                  </button>
                </div>
              </header>
              <div className="p-4">
                <BlockForm
                  block={b}
                  onChange={(patch) => updateBlock(b.id, patch)}
                  onUpload={(kind, itemId) => uploadImageForBlock(b.id, kind, itemId)}
                  uploadingId={uploadingId}
                  blockId={b.id}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Add block palette */}
      <div className="mt-6">
        {addOpen ? (
          <div className="rounded-sm border border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)]/10 p-4">
            <div className="text-sm font-mono uppercase tracking-[0.14em] text-[color:var(--accent)] mb-3">
              Додати блок
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(BLOCK_META) as Block["type"][]).map((t) => {
                const M = BLOCK_META[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => addBlock(t)}
                    className="flex items-center gap-2 px-3 h-10 rounded-sm border border-[color:var(--border-strong)] bg-black/30 text-left hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] transition-colors"
                  >
                    <M.icon className="size-4" weight="bold" />
                    <span className="text-sm">{M.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="mt-3 tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)]"
            >
              ✕ СКАСУВАТИ
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="w-full tactical-text inline-flex items-center justify-center gap-2 h-12 rounded-sm border-2 border-dashed border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/60"
          >
            <PlusIcon className="size-4" weight="bold" />
            ДОДАТИ БЛОК
          </button>
        )}
      </div>
    </section>
  );
}

// Per-block editing form ---------------------------------------------------

function MultiInput({
  label,
  value,
  onChange,
  long,
}: {
  label: string;
  value: Multi | undefined;
  onChange: (v: Multi) => void;
  long?: boolean;
}) {
  const v = value || {};
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--muted)]">
        {label}
      </span>
      <div className="grid gap-2 sm:grid-cols-3">
        {LOCALES.map((lc) =>
          long ? (
            <textarea
              key={lc}
              id={`${id}-${lc}`}
              value={v[lc] || ""}
              onChange={(e) => onChange({ ...v, [lc]: e.target.value })}
              placeholder={lc.toUpperCase()}
              rows={4}
              className="px-3 py-2 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm focus:border-[color:var(--accent)] outline-none font-mono"
            />
          ) : (
            <input
              key={lc}
              id={`${id}-${lc}`}
              value={v[lc] || ""}
              onChange={(e) => onChange({ ...v, [lc]: e.target.value })}
              placeholder={lc.toUpperCase()}
              className="h-10 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm focus:border-[color:var(--accent)] outline-none"
            />
          ),
        )}
      </div>
    </div>
  );
}

function BlockForm({
  block,
  onChange,
  onUpload,
  uploadingId,
  blockId,
}: {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
  onUpload: (kind: "image" | "gallery-item", itemId?: string) => void;
  uploadingId: string | null;
  blockId: string;
}) {
  switch (block.type) {
    case "hero-lite":
      return (
        <div className="flex flex-col gap-4">
          <MultiInput
            label="Eyebrow (невеликий підпис над заголовком)"
            value={block.eyebrow}
            onChange={(v) => onChange({ eyebrow: v } as Partial<Block>)}
          />
          <MultiInput
            label="Заголовок"
            value={block.title}
            onChange={(v) => onChange({ title: v } as Partial<Block>)}
          />
          <MultiInput
            label="Текст"
            value={block.body}
            onChange={(v) => onChange({ body: v } as Partial<Block>)}
            long
          />
        </div>
      );
    case "rich-text":
      return (
        <MultiInput
          label="Текст (markdown-lite: **жирний**, *курсив*, [лінк](url))"
          value={block.body}
          onChange={(v) => onChange({ body: v } as Partial<Block>)}
          long
        />
      );
    case "cta":
      return (
        <div className="flex flex-col gap-4">
          <MultiInput
            label="Текст кнопки"
            value={block.label}
            onChange={(v) => onChange({ label: v } as Partial<Block>)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--muted)]">
                ПОСИЛАННЯ (зовнішнє https:// або /внутрішнє)
              </span>
              <input
                value={block.href || ""}
                onChange={(e) => onChange({ href: e.target.value } as Partial<Block>)}
                placeholder="/join  або  https://discord.gg/..."
                className="h-10 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] font-mono text-sm focus:border-[color:var(--accent)] outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--muted)]">
                Вигляд
              </span>
              <select
                value={block.variant || "primary"}
                onChange={(e) => onChange({ variant: e.target.value as "primary" | "ghost" } as Partial<Block>)}
                className="h-10 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm focus:border-[color:var(--accent)] outline-none"
              >
                <option value="primary">Жовта (акцент)</option>
                <option value="ghost">Прозора (рамка)</option>
              </select>
            </label>
          </div>
        </div>
      );
    case "image":
      return (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--muted)]">
                URL зображення (можна вставити, або завантажити ↓)
              </span>
              <input
                value={block.src || ""}
                onChange={(e) => onChange({ src: e.target.value } as Partial<Block>)}
                placeholder="/images/foo.jpg або https://..."
                className="h-10 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] font-mono text-xs focus:border-[color:var(--accent)] outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => onUpload("image")}
              disabled={uploadingId === blockId}
              className="tactical-text inline-flex items-center gap-2 px-4 h-10 rounded-sm bg-[color:var(--accent)] text-black font-bold hover:bg-[color:var(--accent-hard)] disabled:opacity-50"
            >
              {uploadingId === blockId ? (
                <CircleNotchIcon className="size-4 animate-spin" weight="bold" />
              ) : (
                <UploadSimpleIcon className="size-4" weight="bold" />
              )}
              ЗАВАНТАЖИТИ
            </button>
          </div>
          {block.src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.src}
              alt=""
              className="max-h-52 w-fit rounded-sm border border-[color:var(--border)]"
            />
          )}
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--muted)]">
              ALT (текст для скрін-рідерів / SEO)
            </span>
            <input
              value={block.alt || ""}
              onChange={(e) => onChange({ alt: e.target.value } as Partial<Block>)}
              className="h-10 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm focus:border-[color:var(--accent)] outline-none"
            />
          </label>
          <MultiInput
            label="Підпис (опціонально)"
            value={block.caption}
            onChange={(v) => onChange({ caption: v } as Partial<Block>)}
          />
        </div>
      );
    case "gallery":
      return (
        <div className="flex flex-col gap-3">
          {block.items.length === 0 && (
            <p className="text-sm text-[color:var(--muted-2)]">
              Ще жодного фото. Натисни «Додати фото» нижче.
            </p>
          )}
          {block.items.map((item, idx) => (
            <div
              key={item.id}
              className="grid gap-3 sm:grid-cols-[140px_1fr_auto] items-start p-3 rounded-sm border border-[color:var(--border)] bg-black/20"
            >
              <div className="relative size-[140px] rounded-sm overflow-hidden border border-[color:var(--border)] bg-black">
                {item.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.src} alt="" className="size-full object-cover" />
                ) : (
                  <div className="size-full flex items-center justify-center text-[color:var(--muted)]">
                    <ImageIcon className="size-6" weight="thin" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--muted)]">
                    URL
                  </span>
                  <input
                    value={item.src}
                    onChange={(e) => {
                      const items = [...block.items];
                      items[idx] = { ...item, src: e.target.value };
                      onChange({ items } as Partial<Block>);
                    }}
                    className="h-9 px-3 rounded-sm bg-black/40 border border-[color:var(--border-strong)] font-mono text-xs focus:border-[color:var(--accent)] outline-none"
                  />
                </label>
                <MultiInput
                  label="Підпис"
                  value={item.caption}
                  onChange={(v) => {
                    const items = [...block.items];
                    items[idx] = { ...item, caption: v };
                    onChange({ items } as Partial<Block>);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => onUpload("gallery-item", item.id)}
                  disabled={uploadingId === blockId + item.id}
                  className="size-9 inline-flex items-center justify-center rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 disabled:opacity-50"
                  title="Завантажити фото"
                >
                  {uploadingId === blockId + item.id ? (
                    <CircleNotchIcon className="size-4 animate-spin" weight="bold" />
                  ) : (
                    <UploadSimpleIcon className="size-4" weight="bold" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const items = block.items.filter((_, i) => i !== idx);
                    onChange({ items } as Partial<Block>);
                  }}
                  className="size-9 inline-flex items-center justify-center rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-rose-300 hover:border-rose-500/40"
                  title="Прибрати фото"
                >
                  <TrashIcon className="size-4" weight="bold" />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                items: [...block.items, { id: genId(), src: "", caption: {} }],
              } as Partial<Block>)
            }
            className="tactical-text inline-flex items-center gap-2 px-3 h-9 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 w-fit"
          >
            <PlusIcon className="size-4" weight="bold" />
            ДОДАТИ ФОТО
          </button>
        </div>
      );
    case "divider":
      return (
        <p className="text-xs text-[color:var(--muted)]">
          Горизонтальна лінія для візуального розділу секцій.
        </p>
      );
  }
}
