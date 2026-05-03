"use client";

import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  EyeClosedIcon,
  EyeIcon,
  FloppyDiskIcon,
  ImageIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

import { Link } from "@/i18n/navigation";
import type { MerchItem, Multi } from "@/lib/cms/store";

type Props = {
  initialItems: MerchItem[];
  defaultIds: readonly string[];
};

type EditState = {
  id: string;
  isDefault: boolean;
  hidden: boolean;
  title: Multi;
  price: string;
  shortDesc: Multi;
  longDesc: Multi;
  specs: Multi;
  sizes: string;
  badge: Multi;
};

const EMPTY_MULTI: Multi = { ua: "", ru: "", en: "" };

function toEdit(item: MerchItem | null, id: string, isDefault: boolean): EditState {
  return {
    id,
    isDefault,
    hidden: !!item?.hidden,
    title: { ...EMPTY_MULTI, ...(item?.title || {}) },
    price: item?.price || "",
    shortDesc: { ...EMPTY_MULTI, ...(item?.shortDesc || {}) },
    longDesc: { ...EMPTY_MULTI, ...(item?.longDesc || {}) },
    specs: { ...EMPTY_MULTI, ...(item?.specs || {}) },
    sizes: item?.sizes || "",
    badge: { ...EMPTY_MULTI, ...(item?.badge || {}) },
  };
}

function multiToPayload(m: Multi): Multi | undefined {
  const out: Multi = {};
  for (const lc of ["ua", "ru", "en"] as const) {
    const v = (m[lc] || "").trim();
    if (v) out[lc] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function MerchManager({ initialItems, defaultIds }: Props) {
  const [items, setItems] = useState<MerchItem[]>(initialItems);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});

  // Show all default ids + custom items, in display order.
  const display = useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const out: { id: string; isDefault: boolean; item: MerchItem | null }[] = [];
    for (const id of defaultIds) {
      out.push({ id, isDefault: true, item: byId.get(id) || null });
    }
    for (const it of items) {
      if ((defaultIds as readonly string[]).includes(it.id)) continue;
      out.push({ id: it.id, isDefault: false, item: it });
    }
    return out;
  }, [items, defaultIds]);

  // Fetch photo counts once (so cards show how many photos each item has).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/images")
      .then((r) => r.json())
      .then((j: { overrides?: Record<string, string[]> }) => {
        if (cancelled) return;
        const out: Record<string, number> = {};
        for (const [k, arr] of Object.entries(j.overrides || {})) {
          if (k.startsWith("merch.")) out[k.slice("merch.".length)] = arr.length;
        }
        setPhotoCounts(out);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [items]);

  function startEdit(id: string, isDefault: boolean) {
    setErr(null);
    setInfo(null);
    const cur = items.find((i) => i.id === id) || null;
    setEdit(toEdit(cur, id, isDefault));
  }

  function startCreate() {
    setErr(null);
    setInfo(null);
    setEdit({
      id: "",
      isDefault: false,
      hidden: false,
      title: { ...EMPTY_MULTI },
      price: "",
      shortDesc: { ...EMPTY_MULTI },
      longDesc: { ...EMPTY_MULTI },
      specs: { ...EMPTY_MULTI },
      sizes: "",
      badge: { ...EMPTY_MULTI },
    });
  }

  async function save(e: EditState) {
    setErr(null);
    setSaving(true);
    try {
      if (!e.isDefault && !e.id) throw new Error("Введи slug (id)");
      const payload: Partial<MerchItem> = {
        id: e.id,
        hidden: e.hidden,
        title: multiToPayload(e.title),
        price: e.price.trim() || undefined,
        shortDesc: multiToPayload(e.shortDesc),
        longDesc: multiToPayload(e.longDesc),
        specs: multiToPayload(e.specs),
        sizes: e.sizes.trim() || undefined,
        badge: multiToPayload(e.badge),
      };
      const res = await fetch("/api/admin/merch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => ({}))) as {
        items?: MerchItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      if (j.items) setItems(j.items);
      setEdit(null);
      setInfo("Збережено");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setSaving(false);
    }
  }

  async function toggleHide(id: string, current: MerchItem | null, makeHidden: boolean) {
    setErr(null);
    try {
      const payload: Partial<MerchItem> = {
        ...(current || {}),
        id,
        hidden: makeHidden,
      };
      const res = await fetch("/api/admin/merch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => ({}))) as {
        items?: MerchItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      if (j.items) setItems(j.items);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    }
  }

  async function remove(id: string, isDefault: boolean) {
    const msg = isDefault
      ? `Прибрати дефолтний товар "${id}" з сайту? Його можна повернути перемикачем "Показати".`
      : `Видалити товар "${id}"? Дія незворотня.`;
    if (!confirm(msg)) return;
    setErr(null);
    try {
      const res = await fetch(
        `/api/admin/merch?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      const j = (await res.json().catch(() => ({}))) as {
        items?: MerchItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      if (j.items) setItems(j.items);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
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
          <h1 className="text-3xl font-bold tracking-tight">Каталог мерчу</h1>
          <p className="text-sm text-[color:var(--muted-2)] max-w-2xl">
            Додавай нові товари, редагуй назви, ціни й опис, прикріплюй до 5 фото
            через менеджер зображень. Стандартні товари (прапор, кружка, шеврони)
            можна сховати — повернеш одним кліком.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-2 px-5 h-11 rounded-sm btn-primary text-xs font-mono uppercase tracking-[0.16em] font-bold"
        >
          <PlusIcon className="size-4" weight="bold" />
          Новий товар
        </button>
      </div>

      {err ? (
        <div className="mb-6 flex items-center gap-2 p-3 rounded-sm border border-rose-500/40 bg-rose-500/10 text-rose-200 text-sm">
          <WarningCircleIcon className="size-5" weight="fill" />
          <span>{err}</span>
        </div>
      ) : null}
      {info ? (
        <div className="mb-6 flex items-center gap-2 p-3 rounded-sm border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-sm">
          <CheckCircleIcon className="size-5" weight="fill" />
          <span>{info}</span>
        </div>
      ) : null}

      <div className="grid gap-3">
        {display.map(({ id, isDefault, item }) => {
          const hidden = !!item?.hidden;
          const photoCount = photoCounts[id] || 0;
          const titleAny = item?.title?.ua || item?.title?.ru || item?.title?.en;
          const niceTitle = titleAny || (isDefault ? `${id} (дефолт)` : id);
          return (
            <div
              key={id}
              className={`flex flex-wrap items-center gap-4 p-4 rounded-sm border ${
                hidden
                  ? "border-[color:var(--border)] bg-black/20 opacity-70"
                  : "border-[color:var(--border)] bg-[color:var(--background-elev)]"
              }`}
            >
              <div className="size-12 rounded-sm bg-[color:var(--accent)] flex items-center justify-center shrink-0">
                <ImageIcon className="size-6 text-black" weight="bold" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold tracking-tight truncate">
                    {niceTitle}
                  </span>
                  {isDefault ? (
                    <span className="tactical-text text-[10px] text-[color:var(--accent)] border border-[color:var(--accent)]/40 px-1.5 py-0.5 rounded-sm">
                      ДЕФОЛТ
                    </span>
                  ) : (
                    <span className="tactical-text text-[10px] text-cyan-300 border border-cyan-500/40 px-1.5 py-0.5 rounded-sm">
                      КАСТОМ
                    </span>
                  )}
                  {hidden ? (
                    <span className="tactical-text text-[10px] text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded-sm">
                      ПРИХОВАНИЙ
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-[color:var(--muted-2)] flex flex-wrap items-center gap-3">
                  <span className="font-mono">/{id}</span>
                  {item?.price ? <span>· {item.price}</span> : null}
                  <span>· {photoCount} фото</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/merch/${id}`}
                  className="inline-flex items-center gap-1 px-3 h-9 rounded-sm border border-[color:var(--border)] hover:border-[color:var(--accent)]/40 text-xs font-mono uppercase tracking-[0.12em]"
                  target="_blank"
                >
                  <ArrowSquareOutIcon className="size-3.5" weight="bold" />
                  Перегляд
                </Link>
                <Link
                  href="/admin/images"
                  className="inline-flex items-center gap-1 px-3 h-9 rounded-sm border border-[color:var(--border)] hover:border-[color:var(--accent)]/40 text-xs font-mono uppercase tracking-[0.12em]"
                >
                  <ImageIcon className="size-3.5" weight="bold" />
                  Фото
                </Link>
                <button
                  type="button"
                  onClick={() => toggleHide(id, item, !hidden)}
                  className="inline-flex items-center gap-1 px-3 h-9 rounded-sm border border-[color:var(--border)] hover:border-[color:var(--accent)]/40 text-xs font-mono uppercase tracking-[0.12em]"
                  title={hidden ? "Показати на сайті" : "Сховати з сайту"}
                >
                  {hidden ? (
                    <EyeIcon className="size-3.5" weight="bold" />
                  ) : (
                    <EyeClosedIcon className="size-3.5" weight="bold" />
                  )}
                  {hidden ? "Показати" : "Сховати"}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(id, isDefault)}
                  className="inline-flex items-center gap-1 px-3 h-9 rounded-sm border border-[color:var(--accent)]/40 text-[color:var(--accent)] hover:bg-[color:var(--accent-soft)] text-xs font-mono uppercase tracking-[0.12em]"
                >
                  <PencilSimpleIcon className="size-3.5" weight="bold" />
                  Редаг.
                </button>
                <button
                  type="button"
                  onClick={() => remove(id, isDefault)}
                  className="inline-flex items-center gap-1 px-3 h-9 rounded-sm border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs font-mono uppercase tracking-[0.12em]"
                >
                  <TrashIcon className="size-3.5" weight="bold" />
                  {isDefault ? "Видалити" : "Видалити"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {edit ? (
        <EditModal
          edit={edit}
          existingIds={items.map((i) => i.id)}
          defaultIds={defaultIds}
          saving={saving}
          onClose={() => setEdit(null)}
          onChange={setEdit}
          onSave={() => save(edit)}
        />
      ) : null}
    </section>
  );
}

function EditModal(props: {
  edit: EditState;
  existingIds: string[];
  defaultIds: readonly string[];
  saving: boolean;
  onClose: () => void;
  onChange: (e: EditState) => void;
  onSave: () => void;
}) {
  const { edit, existingIds, defaultIds, saving, onClose, onChange, onSave } =
    props;
  const isNew = !edit.isDefault && !existingIds.includes(edit.id);
  const idTaken =
    isNew &&
    edit.id &&
    (existingIds.includes(edit.id) ||
      (defaultIds as readonly string[]).includes(edit.id));

  function update<K extends keyof EditState>(key: K, val: EditState[K]) {
    onChange({ ...edit, [key]: val });
  }

  function setMulti(field: "title" | "shortDesc" | "longDesc" | "specs" | "badge", lc: keyof Multi, val: string) {
    onChange({ ...edit, [field]: { ...edit[field], [lc]: val } });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-sm border border-[color:var(--border)] bg-[color:var(--background)] p-6 lg:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 size-8 rounded-sm hover:bg-[color:var(--background-elev)] flex items-center justify-center"
        >
          <XIcon className="size-4" weight="bold" />
        </button>
        <h2 className="text-2xl font-bold tracking-tight mb-1">
          {isNew ? "Новий товар" : `Редагування: ${edit.id}`}
        </h2>
        <p className="text-sm text-[color:var(--muted-2)] mb-6">
          {edit.isDefault
            ? "Це стандартний товар. Залиш порожнім будь-яке поле — і використається переклад за замовчуванням."
            : "Заповни хоча б назву українською. Інші поля можна залишити порожніми."}
        </p>

        <div className="grid gap-5">
          {!edit.isDefault && (
            <Field label="ID (slug у URL)" hint="lowercase a–z, 0–9, дефіс. Приклад: belt-2024">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={edit.id}
                  disabled={!isNew}
                  onChange={(ev) =>
                    update("id", slugify(ev.target.value))
                  }
                  className="flex-1 h-10 px-3 rounded-sm bg-[color:var(--background-elev)] border border-[color:var(--border)] font-mono text-sm focus:border-[color:var(--accent)] outline-none disabled:opacity-60"
                  placeholder="custom-item"
                  maxLength={40}
                />
                {isNew && edit.title.ua && !edit.id ? (
                  <button
                    type="button"
                    onClick={() => update("id", slugify(edit.title.ua || ""))}
                    className="px-3 h-10 rounded-sm border border-[color:var(--border)] text-xs font-mono uppercase"
                  >
                    Згенерувати
                  </button>
                ) : null}
              </div>
              {idTaken ? (
                <p className="text-xs text-rose-300 mt-1">Такий id вже існує</p>
              ) : null}
            </Field>
          )}

          <MultiField
            label="Назва"
            value={edit.title}
            onChange={(lc, v) => setMulti("title", lc, v)}
            placeholder="Прапор клану"
          />

          <Field label="Ціна" hint="Будь-який текст, наприклад: «350 ₴» або «$15»">
            <input
              type="text"
              value={edit.price}
              onChange={(ev) => update("price", ev.target.value)}
              className="h-10 px-3 rounded-sm bg-[color:var(--background-elev)] border border-[color:var(--border)] font-mono text-sm focus:border-[color:var(--accent)] outline-none"
              maxLength={80}
              placeholder="350 ₴"
            />
          </Field>

          <MultiField
            label="Короткий опис (картка)"
            value={edit.shortDesc}
            onChange={(lc, v) => setMulti("shortDesc", lc, v)}
            placeholder="2–3 речення"
            multiline
          />
          <MultiField
            label="Повний опис (сторінка товару)"
            value={edit.longDesc}
            onChange={(lc, v) => setMulti("longDesc", lc, v)}
            placeholder="Залиш порожнім — використається короткий"
            multiline
          />
          <MultiField
            label="Характеристики (по одній на рядок)"
            value={edit.specs}
            onChange={(lc, v) => setMulti("specs", lc, v)}
            placeholder={"Матеріал: поліестер\nРозмір: 90×60 см"}
            multiline
            rows={5}
          />

          <Field label="Розміри (через кому)" hint="Залиш порожнім якщо без розмірів. Приклад: M, L, XL">
            <input
              type="text"
              value={edit.sizes}
              onChange={(ev) => update("sizes", ev.target.value)}
              className="h-10 px-3 rounded-sm bg-[color:var(--background-elev)] border border-[color:var(--border)] font-mono text-sm focus:border-[color:var(--accent)] outline-none"
              maxLength={200}
              placeholder="M, L, XL"
            />
          </Field>

          <MultiField
            label="Бейдж (NEW / SALE / тощо, опціонально)"
            value={edit.badge}
            onChange={(lc, v) => setMulti("badge", lc, v)}
            placeholder="NEW"
            small
          />
        </div>

        <div className="flex items-center justify-between mt-8 pt-4 border-t border-[color:var(--border)]">
          <p className="text-xs text-[color:var(--muted-2)]">
            Фото додаються окремо в{" "}
            <Link href="/admin/images" className="text-[color:var(--accent)] underline">
              менеджері зображень
            </Link>{" "}
            (до 5 шт на товар).
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-10 rounded-sm border border-[color:var(--border)] text-xs font-mono uppercase tracking-[0.12em]"
            >
              Скасувати
            </button>
            <button
              type="button"
              disabled={saving || !!idTaken || (!edit.isDefault && !edit.id)}
              onClick={onSave}
              className="inline-flex items-center gap-2 px-5 h-10 rounded-sm btn-primary text-xs font-mono uppercase tracking-[0.16em] font-bold disabled:opacity-60"
            >
              {saving ? (
                <CircleNotchIcon className="size-4 animate-spin" weight="bold" />
              ) : (
                <FloppyDiskIcon className="size-4" weight="bold" />
              )}
              Зберегти
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="tactical-text text-[color:var(--muted-2)]">
        {props.label}
      </span>
      {props.children}
      {props.hint ? (
        <span className="text-[11px] text-[color:var(--muted)]">{props.hint}</span>
      ) : null}
    </label>
  );
}

function MultiField(props: {
  label: string;
  value: Multi;
  onChange: (lc: keyof Multi, v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  small?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="tactical-text text-[color:var(--muted-2)]">
        {props.label}
      </span>
      <div
        className={`grid gap-2 ${props.small ? "sm:grid-cols-3" : "lg:grid-cols-3"}`}
      >
        {(["ua", "ru", "en"] as const).map((lc) => (
          <div key={lc} className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase text-[color:var(--muted)]">
              {lc.toUpperCase()}
            </span>
            {props.multiline ? (
              <textarea
                value={props.value[lc] || ""}
                onChange={(ev) => props.onChange(lc, ev.target.value)}
                rows={props.rows || 3}
                className="px-3 py-2 rounded-sm bg-[color:var(--background-elev)] border border-[color:var(--border)] text-sm focus:border-[color:var(--accent)] outline-none resize-y"
                placeholder={props.placeholder}
                maxLength={4000}
              />
            ) : (
              <input
                type="text"
                value={props.value[lc] || ""}
                onChange={(ev) => props.onChange(lc, ev.target.value)}
                className="h-10 px-3 rounded-sm bg-[color:var(--background-elev)] border border-[color:var(--border)] text-sm focus:border-[color:var(--accent)] outline-none"
                placeholder={props.placeholder}
                maxLength={300}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
