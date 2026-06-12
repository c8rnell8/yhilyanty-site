"use client";

import {
  CircleNotchIcon,
  ImageSquareIcon,
  PaperPlaneRightIcon,
  RobotIcon,
  TrashIcon,
  UserIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";

type MsgImage = { mimeType: string; data: string };
type Applied = { locale: string; key: string; value: string };
type Msg = {
  role: "user" | "model";
  text: string;
  images?: MsgImage[];
  applied?: Applied[];
};

const MAX_ATTACH = 4;
const MAX_ATTACH_BYTES = 3 * 1024 * 1024;
const ATTACH_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const SUGGESTIONS = [
  "Напиши короткий опис нашої спільноти для головної сторінки",
  "Як мені поміняти текст на кнопці вступу?",
  "Придумай новину про набір новобранців",
  "Як додати нову сторінку на сайт?",
];

export function AiAssistant({ configured }: { configured: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<MsgImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function attachFiles(list: FileList | null) {
    if (!list) return;
    setErr(null);
    const files = Array.from(list).slice(0, MAX_ATTACH - pending.length);
    for (const f of files) {
      if (!ATTACH_MIMES.includes(f.type)) {
        setErr("Можна прикріпити лише картинки (PNG, JPG, WebP, GIF).");
        continue;
      }
      if (f.size > MAX_ATTACH_BYTES) {
        setErr(`«${f.name}» завелика — максимум 3 МБ на картинку.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result || "");
        const base64 = url.split(",")[1];
        if (!base64) return;
        setPending((p) =>
          p.length >= MAX_ATTACH ? p : [...p, { mimeType: f.type, data: base64 }],
        );
      };
      reader.readAsDataURL(f);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && pending.length === 0) || busy) return;
    setErr(null);
    const userMsg: Msg = { role: "user", text: trimmed || "Що на цьому зображенні?" };
    if (pending.length) userMsg.images = pending;
    const next: Msg[] = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setPending([]);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMessages([
        ...next,
        { role: "model", text: j.reply, applied: j.applied || [] },
      ]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setMessages(messages);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-[900px] px-4 sm:px-6 lg:px-10 py-10">
      <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/admin"
            className="tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)]"
          >
            ← АДМІН-ПАНЕЛЬ
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            AI-помічник
          </h1>
          <p className="text-sm text-[color:var(--muted-2)] max-w-2xl">
            Запитай як щось зробити на сайті, попроси написати текст чи новину.
            Працює на Google Gemini.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setErr(null);
            }}
            className="tactical-text inline-flex items-center gap-2 px-3 h-10 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-rose-300 hover:border-rose-500/40"
          >
            <TrashIcon className="size-4" weight="bold" />
            ОЧИСТИТИ
          </button>
        )}
      </div>

      {!configured && (
        <div className="mb-6 px-4 py-3 rounded-sm border border-amber-500/40 bg-amber-500/10 text-amber-200 text-sm flex items-start gap-2">
          <WarningCircleIcon className="size-5 shrink-0 mt-0.5" weight="fill" />
          <span>
            Ключ Gemini ще не налаштований. Отримай безкоштовний ключ на{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-amber-100"
            >
              aistudio.google.com/apikey
            </a>{" "}
            і додай його як <code className="font-mono">GEMINI_API_KEY</code> у
            файл <code className="font-mono">.env.local</code>, потім перезапусти
            сайт.
          </span>
        </div>
      )}

      <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] flex flex-col h-[60vh] min-h-[420px]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="m-auto flex flex-col items-center gap-5 text-center max-w-md">
              <div className="size-14 rounded-sm bg-[color:var(--accent-soft)] flex items-center justify-center">
                <RobotIcon className="size-7 text-[color:var(--accent)]" weight="bold" />
              </div>
              <p className="text-sm text-[color:var(--muted-2)]">
                Постав питання або обери приклад нижче:
              </p>
              <div className="grid gap-2 w-full">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={!configured || busy}
                    onClick={() => send(s)}
                    className="text-left text-sm px-3 py-2 rounded-sm border border-[color:var(--border)] bg-black/20 text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`shrink-0 size-8 rounded-sm flex items-center justify-center ${
                  m.role === "user"
                    ? "bg-[color:var(--accent)]"
                    : "bg-[color:var(--accent-soft)]"
                }`}
              >
                {m.role === "user" ? (
                  <UserIcon className="size-4 text-black" weight="bold" />
                ) : (
                  <RobotIcon className="size-4 text-[color:var(--accent)]" weight="bold" />
                )}
              </div>
              <div
                className={`rounded-sm px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap max-w-[80%] ${
                  m.role === "user"
                    ? "bg-[color:var(--accent-soft)] border border-[color:var(--accent)]/30"
                    : "bg-black/30 border border-[color:var(--border)]"
                }`}
              >
                {m.images && m.images.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-2">
                    {m.images.map((img, j) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={j}
                        src={`data:${img.mimeType};base64,${img.data}`}
                        alt=""
                        className="max-h-40 rounded-sm border border-[color:var(--border)]"
                      />
                    ))}
                  </div>
                )}
                {m.text}
                {m.applied && m.applied.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[color:var(--border)] flex flex-col gap-1">
                    {m.applied.map((a, j) => (
                      <span
                        key={j}
                        className="font-mono text-[11px] text-emerald-300 inline-flex items-center gap-1.5"
                      >
                        ✓ {a.locale.toUpperCase()} · {a.key}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex gap-3">
              <div className="shrink-0 size-8 rounded-sm bg-[color:var(--accent-soft)] flex items-center justify-center">
                <RobotIcon className="size-4 text-[color:var(--accent)]" weight="bold" />
              </div>
              <div className="rounded-sm px-3 py-2 bg-black/30 border border-[color:var(--border)] inline-flex items-center gap-2 text-[color:var(--muted-2)]">
                <CircleNotchIcon className="size-4 animate-spin" weight="bold" />
                <span className="text-sm">думаю…</span>
              </div>
            </div>
          )}
        </div>

        {err && (
          <div className="px-4 py-2 border-t border-red-500/40 bg-red-500/10 text-red-300 text-sm inline-flex items-center gap-2">
            <WarningCircleIcon className="size-4 shrink-0" weight="fill" />
            {err}
          </div>
        )}

        {pending.length > 0 && (
          <div className="border-t border-[color:var(--border)] px-3 pt-3 flex gap-2 flex-wrap">
            {pending.map((img, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${img.mimeType};base64,${img.data}`}
                  alt=""
                  className="size-16 object-cover rounded-sm border border-[color:var(--border-strong)]"
                />
                <button
                  type="button"
                  onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-black border border-[color:var(--border-strong)] flex items-center justify-center text-[color:var(--muted-2)] hover:text-rose-300"
                >
                  <XIcon className="size-3" weight="bold" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-[color:var(--border)] p-3 flex items-end gap-2"
        >
          <input
            ref={fileRef}
            type="file"
            accept={ATTACH_MIMES.join(",")}
            multiple
            hidden
            onChange={(e) => attachFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!configured || busy || pending.length >= MAX_ATTACH}
            title="Прикріпити картинку (до 4 шт, по 3 МБ)"
            className="shrink-0 inline-flex items-center justify-center size-10 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40 disabled:opacity-40"
          >
            <ImageSquareIcon className="size-5" weight="bold" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            onPaste={(e) => {
              if (e.clipboardData?.files?.length) {
                e.preventDefault();
                attachFiles(e.clipboardData.files);
              }
            }}
            disabled={!configured || busy}
            rows={1}
            placeholder={configured ? "Напиши повідомлення…" : "Спочатку налаштуй GEMINI_API_KEY"}
            className="flex-1 resize-none max-h-32 px-3 py-2 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm focus:border-[color:var(--accent)] outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!configured || busy || (!input.trim() && pending.length === 0)}
            className="shrink-0 inline-flex items-center justify-center size-10 rounded-sm bg-[color:var(--accent)] text-black hover:bg-[color:var(--accent-hard)] disabled:opacity-40"
          >
            <PaperPlaneRightIcon className="size-5" weight="bold" />
          </button>
        </form>
      </div>
    </section>
  );
}
