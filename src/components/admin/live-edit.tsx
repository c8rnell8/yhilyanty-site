"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Click-to-edit mode for the live site.
 *
 * When a team member turns it on, every piece of text that comes from the
 * translation catalog and every image that belongs to a CMS slot gets a
 * dashed outline. Clicking one opens a small editor; saving goes through the
 * same role-gated admin APIs as the admin panel, so this adds no new attack
 * surface - it's just a different UI over /api/admin/content and
 * /api/admin/images.
 */

const UI_ATTR = "data-live-edit-ui";

const STRINGS: Record<string, Record<string, string>> = {
  ua: {
    edit: "Редагувати сайт",
    exit: "Готово",
    hint: "Клікни по тексту або картинці з рамкою",
    save: "Зберегти",
    cancel: "Скасувати",
    translate: "Перекласти на інші мови",
    saved: "Збережено",
    uploaded: "Картинку замінено",
    error: "Помилка",
    keyLabel: "Ключ",
    newPage: "Нова сторінка",
    newPagePrompt: "Назва нової сторінки:",
  },
  ru: {
    edit: "Редактировать сайт",
    exit: "Готово",
    hint: "Кликни по тексту или картинке с рамкой",
    save: "Сохранить",
    cancel: "Отмена",
    translate: "Перевести на другие языки",
    saved: "Сохранено",
    uploaded: "Картинка заменена",
    error: "Ошибка",
    keyLabel: "Ключ",
    newPage: "Новая страница",
    newPagePrompt: "Название новой страницы:",
  },
  en: {
    edit: "Edit site",
    exit: "Done",
    hint: "Click any outlined text or image",
    save: "Save",
    cancel: "Cancel",
    translate: "Translate to other languages",
    saved: "Saved",
    uploaded: "Image replaced",
    error: "Error",
    keyLabel: "Key",
    newPage: "New page",
    newPagePrompt: "New page title:",
  },
};

const STYLE = `
[data-le-hl] { outline: 1px dashed color-mix(in srgb, var(--accent) 70%, transparent); outline-offset: 2px; cursor: pointer; }
[data-le-hl]:hover { outline: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
img[data-le-hl] { outline-offset: -2px; }
`;

type Editing = { key: string; node: Text; el: HTMLElement };

export function LiveEdit({ locale }: { locale: string }) {
  const t = STRINGS[locale] || STRINGS.ua;
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [draft, setDraft] = useState("");
  const [alsoTranslate, setAlsoTranslate] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  async function createPage() {
    const title = window.prompt(t.newPagePrompt);
    if (!title?.trim()) return;
    setBusy(true);
    try {
      const slug =
        title
          .toLowerCase()
          .replace(/[^a-z0-9а-яіїєґ]+/gi, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || `page-${Date.now().toString(36)}`;
      const res = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          title: { [locale]: title.trim() },
          blocks: [
            { id: crypto.randomUUID(), type: "hero-lite", title: { [locale]: title.trim() } },
            { id: crypto.randomUUID(), type: "rich-text", body: { [locale]: "" } },
          ],
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      // Jump straight into the full page editor for the fresh page.
      router.push(`/${locale}/admin/pages/${j.page.id}`);
    } catch (e) {
      flash(`${t.error}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const undoRef = useRef<(() => void)[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgTargetRef = useRef<{ slot: string; img: HTMLImageElement } | null>(null);

  function cleanup() {
    for (const fn of undoRef.current) fn();
    undoRef.current = [];
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  const scan = useCallback(async () => {
    cleanup();
    setBusy(true);
    try {
      const [cRes, iRes] = await Promise.all([
        fetch(`/api/admin/content?locale=${locale}`, { cache: "no-store" }),
        fetch(`/api/admin/images`, { cache: "no-store" }),
      ]);
      if (!cRes.ok || !iRes.ok) throw new Error(`HTTP ${cRes.status}/${iRes.status}`);
      const c = (await cRes.json()) as {
        defaults: Record<string, string>;
        overrides: Record<string, string>;
      };
      const im = (await iRes.json()) as {
        slots: { key: string; default: string }[];
        overrides: Record<string, string>;
      };

      const valueToKey = new Map<string, string>();
      const merged = { ...c.defaults, ...c.overrides };
      for (const [k, v] of Object.entries(merged)) {
        const val = v.trim();
        if (val.length >= 2 && !valueToKey.has(val)) valueToKey.set(val, k);
      }

      const srcToSlot = new Map<string, string>();
      for (const s of im.slots) {
        srcToSlot.set(s.default, s.key);
        const ov = im.overrides?.[s.key];
        if (ov) srcToSlot.set(ov.split("?")[0], s.key);
      }

      const undo: (() => void)[] = [];

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          const p = (n as Text).parentElement;
          if (
            !p ||
            p.closest(`[${UI_ATTR}]`) ||
            ["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION"].includes(p.tagName)
          )
            return NodeFilter.FILTER_REJECT;
          const txt = n.textContent?.trim();
          return txt && valueToKey.has(txt)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        },
      });
      const nodes: Text[] = [];
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);

      for (const node of nodes) {
        const el = node.parentElement as HTMLElement;
        const key = valueToKey.get((node.textContent || "").trim());
        if (!key) continue;
        el.setAttribute("data-le-hl", "");
        const onClick = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          setEditing({ key, node, el });
          setDraft((node.textContent || "").trim());
        };
        el.addEventListener("click", onClick, true);
        undo.push(() => {
          el.removeAttribute("data-le-hl");
          el.removeEventListener("click", onClick, true);
        });
      }

      document.querySelectorAll("img").forEach((img) => {
        if (img.closest(`[${UI_ATTR}]`)) return;
        const src = (img.getAttribute("src") || "").split("?")[0];
        const slot = srcToSlot.get(src);
        if (!slot) return;
        img.setAttribute("data-le-hl", "");
        const onClick = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          imgTargetRef.current = { slot, img: img as HTMLImageElement };
          fileRef.current?.click();
        };
        img.addEventListener("click", onClick, true);
        undo.push(() => {
          img.removeAttribute("data-le-hl");
          img.removeEventListener("click", onClick, true);
        });
      });

      undoRef.current = undo;
    } catch (e) {
      flash(`${t.error}: ${e instanceof Error ? e.message : String(e)}`);
      setOn(false);
    } finally {
      setBusy(false);
    }
  }, [locale, t.error]);

  useEffect(() => {
    if (!on) {
      cleanup();
      setEditing(null);
      return;
    }
    // Give the new page a beat to render after navigation, then (re)scan.
    const id = setTimeout(scan, 350);
    return () => clearTimeout(id);
  }, [on, pathname, scan]);

  useEffect(() => cleanup, []);

  async function saveText() {
    if (!editing) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, key: editing.key, value: draft }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      editing.node.textContent = draft;
      if (alsoTranslate) {
        await fetch("/api/admin/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: locale,
            to: ["ua", "ru", "en"].filter((l) => l !== locale),
            items: { [editing.key]: draft },
            save: true,
          }),
        }).catch(() => {});
      }
      setEditing(null);
      flash(t.saved);
      scan();
    } catch (e) {
      flash(`${t.error}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    const target = imgTargetRef.current;
    if (!target) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("key", target.slot);
      fd.append("file", file);
      const res = await fetch("/api/admin/images", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      target.img.src = `${j.url}?t=${Date.now()}`;
      flash(t.uploaded);
    } catch (e) {
      flash(`${t.error}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      imgTargetRef.current = null;
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div {...{ [UI_ATTR]: "" }}>
      {on && <style>{STYLE}</style>}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadImage(f);
        }}
      />

      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        title={on ? t.exit : t.edit}
        className={`fixed bottom-5 right-5 z-[9990] h-11 px-4 rounded-sm font-mono text-xs uppercase tracking-[0.14em] border inline-flex items-center gap-2 shadow-lg transition-colors ${
          on
            ? "bg-[color:var(--accent)] text-black border-[color:var(--accent)]"
            : "bg-black/80 backdrop-blur text-[color:var(--accent)] border-[color:var(--accent)]/50 hover:border-[color:var(--accent)]"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor" aria-hidden>
          <path d="M227.31 73.37 182.63 28.68a16 16 0 0 0-22.63 0L36.69 152a15.86 15.86 0 0 0-4.69 11.31V208a16 16 0 0 0 16 16h44.69a15.86 15.86 0 0 0 11.31-4.69L227.31 96a16 16 0 0 0 0-22.63ZM92.69 208H48v-44.69l88-88L180.69 120ZM192 108.68 147.31 64l24-24L216 84.68Z" />
        </svg>
        {busy ? "..." : on ? t.exit : t.edit}
      </button>

      {on && !editing && (
        <button
          type="button"
          onClick={createPage}
          className="fixed bottom-[4.5rem] right-5 z-[9990] h-10 px-3 rounded-sm bg-black/80 backdrop-blur border border-[color:var(--accent)]/50 text-[color:var(--accent)] text-xs font-mono uppercase tracking-[0.12em] inline-flex items-center gap-2 shadow-lg hover:border-[color:var(--accent)]"
        >
          <svg width="13" height="13" viewBox="0 0 256 256" fill="currentColor" aria-hidden>
            <path d="M224 128a8 8 0 0 1-8 8h-80v80a8 8 0 0 1-16 0v-80H40a8 8 0 0 1 0-16h80V40a8 8 0 0 1 16 0v80h80a8 8 0 0 1 8 8Z" />
          </svg>
          {t.newPage}
        </button>
      )}

      {on && !editing && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[9990] px-4 h-9 rounded-sm bg-black/80 backdrop-blur border border-[color:var(--border-strong)] text-[color:var(--muted-2)] text-xs font-mono flex items-center">
          {t.hint}
        </div>
      )}

      {toast && (
        <div className="fixed top-20 right-5 z-[9991] px-4 py-2 rounded-sm bg-black/90 border border-[color:var(--accent)]/50 text-[color:var(--accent)] text-sm font-mono shadow-lg">
          {toast}
        </div>
      )}

      {editing && (
        <div className="fixed inset-x-0 bottom-0 z-[9991] p-4 flex justify-center">
          <div className="w-full max-w-2xl rounded-sm border border-[color:var(--accent)]/50 bg-black/95 backdrop-blur p-4 flex flex-col gap-3 shadow-2xl">
            <span className="font-mono text-[10px] text-[color:var(--muted)] uppercase tracking-[0.14em]">
              {t.keyLabel}: {editing.key}
            </span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.min(6, Math.max(2, Math.ceil(draft.length / 80)))}
              autoFocus
              className="w-full px-3 py-2 rounded-sm bg-black/60 border border-[color:var(--border-strong)] text-sm focus:outline-none focus:border-[color:var(--accent)] resize-y"
            />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <label className="inline-flex items-center gap-2 text-xs text-[color:var(--muted-2)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoTranslate}
                  onChange={(e) => setAlsoTranslate(e.target.checked)}
                  className="accent-[color:var(--accent)]"
                />
                {t.translate}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="h-9 px-4 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] text-xs font-mono uppercase tracking-[0.1em] hover:text-[color:var(--accent)]"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={saveText}
                  disabled={busy}
                  className="h-9 px-4 rounded-sm bg-[color:var(--accent)] text-black text-xs font-mono uppercase tracking-[0.1em] hover:bg-[color:var(--accent-hard)] disabled:opacity-50"
                >
                  {t.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
