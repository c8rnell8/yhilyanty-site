import { NextResponse } from "next/server";

import { requireRole } from "@/lib/cms/guard";
import { rateLimit } from "@/lib/rate-limit";
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
- /admin/content — редагувати будь-який текст на сайті трьома мовами (українська, російська, англійська). Біля кожного тексту є кнопка перекладу: редагуєш однією мовою, тиснеш кнопку — інші дві мови заповнюються автоматично. Кнопка "Перекласти все" зверху перекладає одразу всі твої правки.
- /admin/images — заливати нові фото в галерею і на сторінки.
- /admin/layout-editor — міняти порядок секцій головної сторінки або ховати їх.
- /admin/pages — створювати власні сторінки (текст, фото, галерея, кнопки).
- /admin/nav — редагувати меню зверху і футер.
- /admin/orders — переглядати замовлення мерчу і відмічати виконані (доступно адмінам і власнику).
- /admin/team — видавати посади (тільки власник): адмін або редактор за Discord ID.

Тобі можуть надсилати зображення (скріншоти сайту, фото) — описуй що бачиш і допомагай на їх основі.

Правила відповіді:
- Відповідай тією мовою, якою написав користувач (українською або російською).
- Будь стислим і конкретним. Давай покрокові інструкції простою мовою, без технічного жаргону.
- Якщо просять написати текст для сайту (опис, новину, заклик) — пиши готовий варіант одразу.
- Не вигадуй функції, яких немає в списку вище.`;

const MAX_MESSAGES = 30;
const MAX_LEN = 8000;
const MAX_IMAGES_PER_MSG = 4;
// ~3 MB of raw image = ~4 MB of base64. Plenty for screenshots.
const MAX_IMAGE_B64 = 4 * 1024 * 1024;
const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export async function GET() {
  const guard = await requireRole("editor");
  if (guard) return guard;
  return NextResponse.json({ configured: geminiConfigured() });
}

export async function POST(req: Request) {
  const guard = await requireRole("editor", req);
  if (guard) return guard;

  const limited = rateLimit(req, "ai", 30, 600);
  if (limited) return limited;

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
    const images = (m as { images?: unknown }).images;
    if ((role !== "user" && role !== "model") || typeof text !== "string") {
      return NextResponse.json({ error: "Bad message shape" }, { status: 400 });
    }
    if (text.length > MAX_LEN) {
      return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }
    const msg: ChatMessage = { role, text };
    if (images !== undefined) {
      if (
        role !== "user" ||
        !Array.isArray(images) ||
        images.length > MAX_IMAGES_PER_MSG
      ) {
        return NextResponse.json({ error: "Bad images" }, { status: 400 });
      }
      const clean = [];
      for (const img of images) {
        const mimeType = (img as { mimeType?: unknown }).mimeType;
        const data = (img as { data?: unknown }).data;
        if (
          typeof mimeType !== "string" ||
          !IMAGE_MIMES.has(mimeType) ||
          typeof data !== "string" ||
          !data ||
          data.length > MAX_IMAGE_B64 ||
          !/^[A-Za-z0-9+/=]+$/.test(data)
        ) {
          return NextResponse.json({ error: "Bad image" }, { status: 400 });
        }
        clean.push({ mimeType, data });
      }
      if (clean.length) msg.images = clean;
    }
    history.push(msg);
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
