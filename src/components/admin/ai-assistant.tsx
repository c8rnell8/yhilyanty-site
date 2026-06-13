"use client";

import {
  CircleNotchIcon,
  ImageSquareIcon,
  PaperPlaneRightIcon,
  PlusIcon,
  RobotIcon,
  TrashIcon,
  UserIcon,
  UsersThreeIcon,
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
  authorName?: string;
};

type ChatSummary = {
  id: string;
  scope: "private" | "team";
  ownerId: string | null;
  title: string;
  updatedAt: string;
  messageCount: number;
};

const MAX_ATTACH = 4;
const MAX_ATTACH_BYTES = 3 * 1024 * 1024;
const ATTACH_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function AiAssistant({ configured }: { configured: boolean }) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<MsgImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshChats();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  async function refreshChats() {
    try {
      const res = await fetch("/api/admin/chats", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (res.ok) setChats(j.chats || []);
    } catch {
      /* ignore */
    }
  }

  async function openChat(id: string) {
    setActiveId(id);
    setLoadingChat(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/chats/${id}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMessages(
        (j.chat.messages || []).map((m: Record<string, unknown>) => ({
          role: m.role,
          text: m.text,
          images: m.images,
          authorName: m.authorName,
        })),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingChat(false);
    }
  }

  async function newChat(scope: "private" | "team") {
    setErr(null);
    try {
      const res = await fetch("/api/admin/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, title: "Новий чат" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      await refreshChats();
      setActiveId(j.chat.id);
      setMessages([]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function deleteChat(id: string) {
    if (!window.confirm("Видалити цей чат разом з історією?")) return;
    await fetch(`/api/admin/chats/${id}`, { method: "DELETE" });
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    refreshChats();
  }

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

  async function send(textIn: string) {
    const trimmed = textIn.trim();
    if ((!trimmed && pending.length === 0) || busy) return;
    if (!activeId) {
      // No chat selected yet → start a private one, then send.
      await newChat("private");
      return;
    }
    setErr(null);
    const sentImages = pending;
    const userMsg: Msg = {
      role: "user",
      text: trimmed || "Подивись на зображення.",
      images: sentImages.length ? sentImages : undefined,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setPending([]);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: activeId,
          text: trimmed,
          images: sentImages,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setMessages([
        ...next,
        { role: "model", text: j.reply, applied: j.applied || [] },
      ]);
      refreshChats();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setMessages(messages);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-10 py-10">
      <div className="flex flex-col gap-2 mb-6">
        <Link
          href="/admin"
          className="tactical-text text-[color:var(--muted-2)] hover:text-[color:var(--accent)]"
        >
          ← АДМІН-ПАНЕЛЬ
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">AI-помічник</h1>
        <p className="text-sm text-[color:var(--muted-2)] max-w-2xl">
          Питай як щось зробити, проси написати текст чи відразу зміни тексти
          сайту. Чати зберігаються — помічник памʼятає всю розмову. Приватні
          чати бачиш тільки ти, спільні — вся команда.
        </p>
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
            і додай як <code className="font-mono">GEMINI_API_KEY</code>.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Chat list */}
        <aside className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => newChat("private")}
              className="tactical-text inline-flex items-center justify-center gap-1.5 h-10 rounded-sm bg-[color:var(--accent)] text-black font-bold hover:bg-[color:var(--accent-hard)]"
            >
              <PlusIcon className="size-4" weight="bold" />
              Приватний
            </button>
            <button
              type="button"
              onClick={() => newChat("team")}
              className="tactical-text inline-flex items-center justify-center gap-1.5 h-10 rounded-sm border border-[color:var(--border-strong)] text-[color:var(--muted-2)] hover:text-[color:var(--accent)] hover:border-[color:var(--accent)]/40"
            >
              <UsersThreeIcon className="size-4" weight="bold" />
              Спільний
            </button>
          </div>

          <div className="flex flex-col gap-1 max-h-[55vh] overflow-y-auto">
            {chats.length === 0 && (
              <p className="text-xs text-[color:var(--muted)] p-3">
                Чатів ще немає. Створи перший кнопкою вище.
              </p>
            )}
            {chats.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-2 px-3 h-11 rounded-sm border cursor-pointer ${
                  activeId === c.id
                    ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                    : "border-[color:var(--border)] hover:border-[color:var(--accent)]/40"
                }`}
                onClick={() => openChat(c.id)}
              >
                {c.scope === "team" ? (
                  <UsersThreeIcon className="size-4 shrink-0 text-cyan-300" weight="bold" />
                ) : (
                  <UserIcon className="size-4 shrink-0 text-[color:var(--muted-2)]" weight="bold" />
                )}
                <span className="flex-1 min-w-0 truncate text-sm">{c.title}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(c.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-[color:var(--muted)] hover:text-rose-300"
                >
                  <TrashIcon className="size-3.5" weight="bold" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Conversation */}
        <div className="rounded-sm border border-[color:var(--border)] bg-[color:var(--background-elev)] flex flex-col h-[62vh] min-h-[440px]">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {!activeId ? (
              <div className="m-auto flex flex-col items-center gap-4 text-center max-w-md">
                <div className="size-14 rounded-sm bg-[color:var(--accent-soft)] flex items-center justify-center">
                  <RobotIcon className="size-7 text-[color:var(--accent)]" weight="bold" />
                </div>
                <p className="text-sm text-[color:var(--muted-2)]">
                  Обери чат зліва або створи новий, щоб почати розмову.
                </p>
              </div>
            ) : loadingChat ? (
              <div className="m-auto text-[color:var(--muted-2)] inline-flex items-center gap-2">
                <CircleNotchIcon className="size-4 animate-spin" weight="bold" />
                Завантаження…
              </div>
            ) : messages.length === 0 ? (
              <div className="m-auto text-sm text-[color:var(--muted-2)] text-center">
                Напиши перше повідомлення.
              </div>
            ) : (
              messages.map((m, i) => (
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
                    {m.authorName && m.role === "user" && (
                      <span className="block text-[10px] font-mono text-[color:var(--muted)] mb-1">
                        {m.authorName}
                      </span>
                    )}
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
              ))
            )}

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
              disabled={!configured || busy || !activeId || pending.length >= MAX_ATTACH}
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
              disabled={!configured || busy || !activeId}
              rows={1}
              placeholder={
                !activeId
                  ? "Спочатку обери або створи чат"
                  : configured
                    ? "Напиши повідомлення…"
                    : "Спочатку налаштуй GEMINI_API_KEY"
              }
              className="flex-1 resize-none max-h-32 px-3 py-2 rounded-sm bg-black/40 border border-[color:var(--border-strong)] text-sm focus:border-[color:var(--accent)] outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!configured || busy || !activeId || (!input.trim() && pending.length === 0)}
              className="shrink-0 inline-flex items-center justify-center size-10 rounded-sm bg-[color:var(--accent)] text-black hover:bg-[color:var(--accent-hard)] disabled:opacity-40"
            >
              <PaperPlaneRightIcon className="size-5" weight="bold" />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
