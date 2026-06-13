"use client";

import {
  CheckIcon,
  CircleNotchIcon,
  CopyIcon,
  FilmStripIcon,
  TrashIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";

type MediaFile = {
  name: string;
  bytes: number;
  mtime: number;
  url: string;
  kind: "image" | "video";
};

function fmtSize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

export function MediaLibrary() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const res = await fetch("/api/admin/media", { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) setFiles(j.files || []);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setErr(null);
    const all = Array.from(list);
    for (let i = 0; i < all.length; i++) {
      setProgress(`${i + 1}/${all.length}`);
      const fd = new FormData();
      fd.append("file", all[i]);
      try {
        const res = await fetch("/api/admin/media", { method: "POST", body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`${all[i].name}: ${j.error || res.status}`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        break;
      }
    }
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    refresh();
  }

  async function remove(name: string) {
    if (!window.confirm("Видалити файл з медіатеки? Якщо він десь вставлений на сайті — там він зникне.")) return;
    await fetch(`/api/admin/media?file=${encodeURIComponent(name)}`, { method: "DELETE" });
    refresh();
  }

  async function copyUrl(f: MediaFile) {
    try {
      await navigator.clipboard.writeText(new URL(f.url, window.location.origin).toString());
      setCopied(f.name);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  }

  return (
    <section className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-12 lg:py-16">
      <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/admin"
            className="tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)]"
          >
            ← АДМІН-ПАНЕЛЬ
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Медіатека</h1>
          <p className="text-sm text-[color:var(--muted-2)] max-w-2xl">
            Фото, гіфки і відео до 50 МБ. Завантажуй скільки завгодно, копіюй
            посилання і встав його будь-де: у власну сторінку, кнопку чи меню.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
          multiple
          hidden
          onChange={(e) => upload(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={progress !== null}
          className="tactical-text inline-flex items-center gap-2 px-4 h-11 rounded-sm bg-[color:var(--accent)] text-black font-bold hover:bg-[color:var(--accent-hard)] disabled:opacity-60"
        >
          {progress ? (
            <>
              <CircleNotchIcon className="size-4 animate-spin" weight="bold" />
              ЗАВАНТАЖУЮ {progress}
            </>
          ) : (
            <>
              <UploadSimpleIcon className="size-4" weight="bold" />
              ЗАВАНТАЖИТИ ФАЙЛИ
            </>
          )}
        </button>
      </div>

      {err && (
        <div className="mb-6 px-4 py-3 rounded-sm border border-red-500/40 bg-red-500/10 text-red-300 text-sm">
          {err}
        </div>
      )}

      {files.length === 0 ? (
        <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] p-12 text-center text-[color:var(--muted-2)] flex flex-col items-center gap-3">
          <FilmStripIcon className="size-9" weight="bold" />
          <span className="text-sm">Поки що порожньо — натисни «Завантажити файли».</span>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {files.map((f) => (
            <div
              key={f.name}
              className="rounded-sm border border-[color:var(--border-strong)] bg-[color:var(--background-elev)] overflow-hidden flex flex-col"
            >
              <div className="relative bg-black aspect-video">
                {f.kind === "video" ? (
                  <video
                    src={f.url}
                    className="absolute inset-0 w-full h-full object-contain"
                    controls
                    preload="metadata"
                    muted
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.url}
                    alt={f.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="p-3 flex flex-col gap-2">
                <span className="font-mono text-xs truncate" title={f.name}>
                  {f.name}
                </span>
                <span className="tactical-text text-[10px] text-[color:var(--muted)]">
                  {f.kind === "video" ? "ВІДЕО" : "ФОТО"} · {fmtSize(f.bytes)}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => copyUrl(f)}
                    className="tactical-text inline-flex items-center justify-center gap-1 h-8 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40"
                  >
                    {copied === f.name ? (
                      <>
                        <CheckIcon className="size-3.5" weight="bold" />
                        OK
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3.5" weight="bold" />
                        URL
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(f.name)}
                    className="tactical-text inline-flex items-center justify-center gap-1 h-8 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-rose-300 hover:border-rose-500/40"
                  >
                    <TrashIcon className="size-3.5" weight="bold" />
                    DEL
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
