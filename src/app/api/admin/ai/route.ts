import { NextResponse } from "next/server";

import { requireOwner } from "@/lib/cms/guard";
import {
  geminiChat,
  geminiConfigured,
  GeminiError,
  type ChatMessage,
} from "@/lib/ai/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `Ти — помічник власника сайту спільноти "yhilyanty" (українська ігрова/військова спільнота, ігри Squad та Arma).
Власник не програміст. Допомагай йому керувати сайтом простими словами.

Що вміє адмін-панель сайту:
- /admin/content — редагувати будь-який текст на сайті трьома мовами (українська, російська, англійська).
- /admin/images — заливати нові фото в галерею і на сторінки.
- /admin/layout-editor — міняти порядок секцій головної сторінки або ховати їх.
- /admin/pages — створювати власні сторінки (текст, фото, галерея, кнопки).
- /admin/nav — редагувати меню зверху і футер.

Правила відповіді:
- Відповідай тією мовою, якою написав користувач (українською або російською).
- Будь стислим і конкретним. Давай покрокові інструкції простою мовою, без технічного жаргону.
- Якщо просять написати текст для сайту (опис, новину, заклик) — пиши готовий варіант одразу.
- Не вигадуй функції, яких немає в списку вище.`;

const MAX_MESSAGES = 30;
const MAX_LEN = 8000;

export async function GET() {
  const guard = await requireOwner();
  if (guard) return guard;
  return NextResponse.json({ configured: geminiConfigured() });
}

export async function POST(req: Request) {
  const guard = await requireOwner(req);
  if (guard) return guard;

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = Array.isArray(body.messages) ? body.messages : null;
  if (!raw || raw.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }
  if (raw.length > MAX_MESSAGES) {
    return NextResponse.json(
      { error: `Too many messages (max ${MAX_MESSAGES})` },
      { status: 400 },
    );
  }

  const history: ChatMessage[] = [];
  for (const m of raw) {
    const role = (m as { role?: unknown }).role;
    const text = (m as { text?: unknown }).text;
    if ((role !== "user" && role !== "model") || typeof text !== "string") {
      return NextResponse.json({ error: "Bad message shape" }, { status: 400 });
    }
    if (text.length > MAX_LEN) {
      return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }
    history.push({ role, text });
  }

  try {
    const reply = await geminiChat(history, SYSTEM_PROMPT);
    return NextResponse.json({ reply });
  } catch (e) {
    if (e instanceof GeminiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI error" },
      { status: 500 },
    );
  }
}
