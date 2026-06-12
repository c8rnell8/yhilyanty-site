"use client";

import {
  CircleNotchIcon,
  PaperPlaneRightIcon,
  RobotIcon,
  TrashIcon,
  UserIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";

type Msg = { role: "user" | "model"; text: string };

const SUGGESTIONS = [
  "Напиши короткий опис нашої спільноти для головної сторінки",
  "Як мені поміняти текст на кнопці вступу?",
  "Придумай новину про набір новобранців",
  "Як додати нову сторінку на сайт?",
];

export function AiAssistant({ configured }: { configured: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setErr(null);
    const next: Msg[] = [...messages, { role: "user", text: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMessages([...next, { role: "model", text: j.reply }]);
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
                {m.text}
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-[color:var(--border)] p-3 flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            disabled={!configured || busy}
            rows={1}
            placeholder={configured ? "Напиши повідомлення…" : "Спочатку налаштуй GEMINI_API_KEY"}
            className="flex-1 resize-none max-h-32 px-3 py-2 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm focus:border-[color:var(--accent)] outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!configured || busy || !input.trim()}
            className="shrink-0 inline-flex items-center justify-center size-10 rounded-sm bg-[color:var(--accent)] text-black hover:bg-[color:var(--accent-hard)] disabled:opacity-40"
          >
            <PaperPlaneRightIcon className="size-5" weight="bold" />
          </button>
        </form>
      </div>
    </section>
  );
}
