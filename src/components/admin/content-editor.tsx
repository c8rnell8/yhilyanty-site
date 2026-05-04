"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import {
  ArrowCounterClockwiseIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  MagnifyingGlassIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import { Link } from "@/i18n/navigation";

type LocaleMap = Record<string, Record<string, string>>;

export function ContentEditor({
  locale,
  locales,
  defaults,
  initialOverrides,
}: {
  locale: string;
  locales: string[];
  defaults: LocaleMap;
  initialOverrides: LocaleMap;
}) {
  const [activeLocale, setActiveLocale] = useState(locale);
  const [overrides, setOverrides] = useState<LocaleMap>(initialOverrides);
  const [filter, setFilter] = useState("");
  const [namespace, setNamespace] = useState<string>("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [errorByKey, setErrorByKey] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  // Live split-view preview. iframe reloads after every successful save.
  const [splitView, setSplitView] = useState(true);
  const [previewBust, setPreviewBust] = useState(0);
  const [previewPath, setPreviewPath] = useState("/");

  const localeDefaults = defaults[activeLocale] || {};
  const localeOverrides = overrides[activeLocale] || {};

  const namespaces = useMemo(() => {
    const set = new Set<string>();
    for (const k of Object.keys(localeDefaults)) {
      const idx = k.indexOf(".");
      set.add(idx < 0 ? "(root)" : k.slice(0, idx));
    }
    return Array.from(set).sort();
  }, [localeDefaults]);

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list: { key: string; def: string; ovr: string | undefined }[] = [];
    for (const [key, def] of Object.entries(localeDefaults)) {
      if (namespace && !key.startsWith(namespace + ".") && namespace !== "(root)") continue;
      if (namespace === "(root)" && key.includes(".")) continue;
      if (f) {
        const hay = (key + " " + def + " " + (localeOverrides[key] || "")).toLowerCase();
        if (!hay.includes(f)) continue;
      }
      list.push({ key, def, ovr: localeOverrides[key] });
    }
    list.sort((a, b) => a.key.localeCompare(b.key));
    return list;
  }, [localeDefaults, localeOverrides, filter, namespace]);

  const overrideCount = Object.keys(localeOverrides).length;

  // Auto-clear "saved" indicator
  useEffect(() => {
    if (!savedKey) return;
    const t = setTimeout(() => setSavedKey(null), 2000);
    return () => clearTimeout(t);
  }, [savedKey]);

  async function save(key: string) {
    const value = drafts[key] ?? localeOverrides[key] ?? localeDefaults[key];
    setSavingKey(key);
    setErrorByKey((p) => {
      const c = { ...p };
      delete c[key];
      return c;
    });
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: activeLocale, key, value }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const j = await res.json();
      setOverrides((p) => ({ ...p, [activeLocale]: j.overrides || {} }));
      setDrafts((p) => {
        const c = { ...p };
        delete c[key];
        return c;
      });
      setSavedKey(key);
      setPreviewBust((n) => n + 1);
      // Refresh server-rendered pages so visitors see the new text immediately
      startTransition(() => {});
    } catch (e) {
      setErrorByKey((p) => ({
        ...p,
        [key]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setSavingKey((cur) => (cur === key ? null : cur));
    }
  }

  async function reset(key: string) {
    setSavingKey(key);
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: activeLocale, key, value: null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const j = await res.json();
      setOverrides((p) => ({ ...p, [activeLocale]: j.overrides || {} }));
      setDrafts((p) => {
        const c = { ...p };
        delete c[key];
        return c;
      });
      setSavedKey(key);
      setPreviewBust((n) => n + 1);
    } catch (e) {
      setErrorByKey((p) => ({
        ...p,
        [key]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setSavingKey((cur) => (cur === key ? null : cur));
    }
  }

  // Make the preview path follow the active locale (/ua, /ru, /en).
  const previewHref = `/${activeLocale}${
    previewPath.startsWith("/") ? previewPath : "/" + previewPath
  }${previewPath.includes("?") ? "&" : "?"}__t=${previewBust}`;
  const QUICK_PATHS: { label: string; path: string }[] = [
    { label: "HOME", path: "/" },
    { label: "BOT", path: "/bot" },
    { label: "MERCH", path: "/merch" },
    { label: "JOIN", path: "/join" },
    { label: "ROSTER", path: "/roster" },
  ];

  return (
    <section
      className={
        splitView
          ? "mx-auto w-full px-4 sm:px-6 lg:px-10 py-6"
          : "mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-12 lg:py-16"
      }
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-6 mb-6">
        <div className="flex flex-col gap-2 min-w-0">
          <Link
            href="/admin"
            className="tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)]"
          >
            ← АДМІН-ПАНЕЛЬ
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Редактор текстів
          </h1>
          <p className="text-sm text-[color:var(--muted-2)] max-w-2xl">
            Кожний напис на сайті — окремий ключ. Зміни зберігаються поверх
            базових перекладів і застосовуються миттєво. Натисни{" "}
            <ArrowCounterClockwiseIcon className="inline size-3.5 -mt-0.5" weight="bold" />
            {" "}щоб повернути базове значення.
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <span className="tactical-text text-[color:var(--muted)]">
            ОВЕРРАЙДІВ: <span className="text-[color:var(--accent)]">{overrideCount}</span>
          </span>
          {isPending && (
            <span className="tactical-text text-[color:var(--accent)] inline-flex items-center gap-1">
              <CircleNotchIcon className="size-3 animate-spin" /> SYNC
            </span>
          )}
          <button
            type="button"
            onClick={() => setSplitView((v) => !v)}
            className={`tactical-text inline-flex items-center gap-2 px-3 h-8 rounded-sm border ${
              splitView
                ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                : "border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:border-[color:var(--accent)]/60"
            }`}
            title="Показати живе превью сайту поруч"
          >
            {splitView ? "ПРЕВ'Ю УВІМК" : "ПРЕВ'Ю ВИМК"}
          </button>
        </div>
      </div>

      <div className={splitView ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "contents"}>
      <div className={splitView ? "flex flex-col gap-0 min-w-0" : "contents"}>

      {/* Locale tabs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {locales.map((lc) => (
          <button
            key={lc}
            type="button"
            onClick={() => setActiveLocale(lc)}
            aria-pressed={lc === activeLocale}
            className={`px-4 h-9 rounded-sm border tactical-text transition-colors ${
              lc === activeLocale
                ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                : "border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:border-[color:var(--accent)]/40"
            }`}
          >
            {lc.toUpperCase()}{" "}
            <span className="ml-1 text-[color:var(--muted)]">
              {Object.keys(overrides[lc] || {}).length || ""}
            </span>
          </button>
        ))}
      </div>

      {/* Filter + namespace */}
      <div className="flex flex-wrap gap-3 mb-6">
        <label className="flex-1 min-w-[280px] flex items-center gap-2 px-3 h-11 rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--background-elev)] focus-within:border-[color:var(--accent)]">
          <MagnifyingGlassIcon className="size-4 text-[color:var(--muted)]" weight="bold" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Фільтр: ключ або текст…"
            className="bg-transparent flex-1 outline-none text-sm font-mono"
          />
        </label>
        <select
          value={namespace}
          onChange={(e) => setNamespace(e.target.value)}
          className="h-11 px-3 rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--background-elev)] text-sm font-mono focus:outline-none focus:border-[color:var(--accent)]"
        >
          <option value="">Усі секції ({namespaces.length})</option>
          {namespaces.map((n) => (
            <option key={n} value={n}>
              {n} ({Object.keys(localeDefaults).filter((k) => k.startsWith(n + ".") || (n === "(root)" && !k.includes("."))).length})
            </option>
          ))}
        </select>
      </div>

      {/* Rows */}
      <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-[color:var(--muted-2)] tactical-text">
            Нічого не знайдено
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--border)]">
            {rows.map(({ key, def, ovr }) => {
              const draft = drafts[key];
              const current = draft ?? ovr ?? def;
              const isOverridden = ovr !== undefined;
              const isDirty = draft !== undefined && draft !== (ovr ?? def);
              const isLong = current.length > 100 || current.includes("\n");
              return (
                <div
                  key={key}
                  className={`p-4 flex flex-col gap-2 ${
                    isOverridden ? "bg-[color:var(--accent-soft)]/30" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-[color:var(--accent)]">
                        {key}
                      </span>
                      {isOverridden && (
                        <span className="tactical-text text-[10px] px-1.5 py-0.5 rounded-sm border border-[color:var(--accent)]/40 text-[color:var(--accent)]">
                          OVERRIDE
                        </span>
                      )}
                      {savedKey === key && (
                        <span className="tactical-text text-[10px] inline-flex items-center gap-1 text-emerald-300">
                          <CheckCircleIcon className="size-3" weight="fill" />
                          SAVED
                        </span>
                      )}
                      {errorByKey[key] && (
                        <span className="tactical-text text-[10px] inline-flex items-center gap-1 text-red-400">
                          <WarningCircleIcon className="size-3" weight="fill" />
                          {errorByKey[key]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isOverridden && (
                        <button
                          type="button"
                          onClick={() => reset(key)}
                          disabled={savingKey === key}
                          title="Повернути базовий текст"
                          className="tactical-text inline-flex items-center gap-1 px-2 h-8 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 disabled:opacity-50"
                        >
                          <ArrowCounterClockwiseIcon className="size-3" weight="bold" />
                          RESET
                        </button>
                      )}
                      {isDirty && (
                        <button
                          type="button"
                          onClick={() => save(key)}
                          disabled={savingKey === key}
                          className="tactical-text inline-flex items-center gap-1 px-3 h-8 rounded-sm bg-[color:var(--accent)] text-black hover:bg-[color:var(--accent-hard)] disabled:opacity-50"
                        >
                          {savingKey === key ? (
                            <CircleNotchIcon className="size-3 animate-spin" weight="bold" />
                          ) : (
                            <CheckCircleIcon className="size-3" weight="bold" />
                          )}
                          SAVE
                        </button>
                      )}
                    </div>
                  </div>
                  {isLong ? (
                    <textarea
                      value={current}
                      onChange={(e) =>
                        setDrafts((p) => ({ ...p, [key]: e.target.value }))
                      }
                      onBlur={() => {
                        if (drafts[key] !== undefined && drafts[key] !== (ovr ?? def))
                          save(key);
                      }}
                      rows={Math.min(6, Math.max(2, Math.ceil(current.length / 80)))}
                      className="w-full px-3 py-2 rounded-sm bg-[color:var(--background)] border border-[color:var(--border-strong)] text-sm font-mono focus:outline-none focus:border-[color:var(--accent)] resize-y"
                    />
                  ) : (
                    <input
                      value={current}
                      onChange={(e) =>
                        setDrafts((p) => ({ ...p, [key]: e.target.value }))
                      }
                      onBlur={() => {
                        if (drafts[key] !== undefined && drafts[key] !== (ovr ?? def))
                          save(key);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (drafts[key] !== undefined && drafts[key] !== (ovr ?? def))
                            save(key);
                        }
                      }}
                      className="w-full h-10 px-3 rounded-sm bg-[color:var(--background)] border border-[color:var(--border-strong)] text-sm font-mono focus:outline-none focus:border-[color:var(--accent)]"
                    />
                  )}
                  {isOverridden && def !== current && !isDirty && (
                    <span className="tactical-text text-[10px] text-[color:var(--muted)] truncate">
                      базове: <span className="text-[color:var(--muted-2)]">{def}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-[color:var(--muted)] tactical-text">
        TIP: при перемиканні мови на сайті відображається відповідна локаль —
        тут ти можеш редагувати кожну мову окремо. Якщо для UA задано оверрайд,
        а для RU/EN ні — UA-користувач побачить твій текст, RU/EN — оригінал.
      </p>
      </div>{/* end form column */}

      {splitView && (
        <aside
          className="lg:sticky lg:top-4 self-start rounded-sm border border-[color:var(--border-strong)] bg-black overflow-hidden flex flex-col"
          style={{ height: "calc(100vh - 120px)" }}
        >
          <div className="flex items-center gap-2 px-3 h-10 border-b border-[color:var(--border-strong)] bg-[color:var(--background-elev)]">
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <span className="tactical-text text-[color:var(--muted)] shrink-0">
                /{activeLocale}
              </span>
              <input
                value={previewPath}
                onChange={(e) => setPreviewPath(e.target.value)}
                className="flex-1 h-7 px-2 rounded-sm bg-[color:var(--background)] border border-[color:var(--border-strong)] font-mono text-xs focus:border-[color:var(--accent)] outline-none min-w-0"
                placeholder="/"
              />
            </div>
            <button
              type="button"
              onClick={() => setPreviewBust((n) => n + 1)}
              className="tactical-text px-2 h-7 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              title="Перезавантажити iframe"
            >
              ↻
            </button>
            <a
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="tactical-text px-2 h-7 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] inline-flex items-center"
              title="Відкрити в новій вкладці"
            >
              ↗
            </a>
          </div>
          <div className="flex items-center gap-1 px-3 py-2 border-b border-[color:var(--border-strong)] bg-[color:var(--background-elev)] flex-wrap">
            {QUICK_PATHS.map((qp) => (
              <button
                key={qp.path}
                type="button"
                onClick={() => {
                  setPreviewPath(qp.path);
                  setPreviewBust((n) => n + 1);
                }}
                className={`tactical-text px-2 h-6 rounded-sm border ${
                  previewPath === qp.path
                    ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                    : "border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:border-[color:var(--accent)]/40"
                }`}
              >
                {qp.label}
              </button>
            ))}
          </div>
          <iframe
            key={`${activeLocale}-${previewBust}`}
            src={previewHref}
            className="flex-1 w-full bg-black"
            title="Live site preview"
          />
          <p className="tactical-text text-[10px] text-[color:var(--muted)] px-3 py-1.5 border-t border-[color:var(--border-strong)]">
            Прев&apos;ю перемальовується автоматично після збереження кожного
            ключа. Кнопки зверху — швидкий перехід на різні сторінки.
          </p>
        </aside>
      )}
      </div>{/* end split grid */}
    </section>
  );
}
