import { NextResponse } from "next/server";

import { auditLog } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { requireRole } from "@/lib/cms/guard";
import { flattenMessages, readTextOverrides, setTextOverride } from "@/lib/cms/store";
import { rateLimit } from "@/lib/rate-limit";
import { routing } from "@/i18n/routing";
import {
  readChatAuthorized,
  writeChat,
  type StoredImage,
  type StoredMessage,
} from "@/lib/ai/chats";
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

ТИ МОЖЕШ САМ МІНЯТИ ТЕКСТИ САЙТУ. Нижче — каталог текстів у форматі мова|ключ|поточний текст.
Якщо користувач просить змінити текст (наприклад "поміняй заголовок на ..."), знайди потрібний ключ у каталозі
і додай у САМИЙ КІНЕЦЬ відповіді окремим рядком блок дії (можна кілька):
[[ACTION]]{"action":"set_text","locale":"ua","key":"Hero.title","value":"Новий текст"}[[/ACTION]]
Правила дій:
- Використовуй тільки ключі, які Є в каталозі, і locale з: ua, ru, en.
- Якщо користувач не сказав, якою мовою міняти — зміни всі три (три блоки, переклади текст відповідно).
- Перед блоками дій коротко скажи людською мовою, що саме міняєш. Не показуй сам JSON користувачу.
- Якщо прохання неоднозначне — спершу перепитай, нічого не міняй.

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

/** All site texts as "locale|key|value" lines for the system prompt, plus
 *  the set of valid keys so we never write anything the model invented. */
async function buildCatalog(): Promise<{ text: string; keys: Set<string> }> {
  const overrides = await readTextOverrides();
  const lines: string[] = [];
  const keys = new Set<string>();
  for (const lc of routing.locales) {
    const base = (await import(`../../../../messages/${lc}.json`)).default;
    const merged: Record<string, string> = {
      ...flattenMessages(base),
      ...(overrides[lc] || {}),
    };
    for (const [k, v] of Object.entries(merged)) {
      keys.add(k);
      lines.push(`${lc}|${k}|${String(v).replace(/\s+/g, " ").slice(0, 80)}`);
    }
  }
  return { text: lines.join("\n"), keys };
}

const ACTION_RE = /\[\[ACTION\]\]\s*([\s\S]*?)\s*\[\[\/ACTION\]\]/g;
const MAX_ACTIONS = 10;

type Applied = { locale: string; key: string; value: string };

/** Pull action blocks out of the model reply, apply the valid ones, and
 *  return the reply with the raw JSON stripped out. */
async function applyActions(
  raw: string,
  validKeys: Set<string>,
  actor: { id: string; username?: string; globalName?: string | null } | null,
): Promise<{ reply: string; applied: Applied[] }> {
  const applied: Applied[] = [];
  const locales = routing.locales as readonly string[];

  const matches = [...raw.matchAll(ACTION_RE)].slice(0, MAX_ACTIONS);
  for (const m of matches) {
    try {
      const a = JSON.parse(m[1]) as {
        action?: unknown;
        locale?: unknown;
        key?: unknown;
        value?: unknown;
      };
      if (
        a.action !== "set_text" ||
        typeof a.locale !== "string" ||
        !locales.includes(a.locale) ||
        typeof a.key !== "string" ||
        !validKeys.has(a.key) ||
        typeof a.value !== "string" ||
        !a.value.trim() ||
        a.value.length > 4000
      )
        continue;
      await setTextOverride(a.locale, a.key, a.value);
      await auditLog(actor, "ai.set_text", `${a.locale}|${a.key}`);
      applied.push({ locale: a.locale, key: a.key, value: a.value });
    } catch {
      // a malformed block is the model's problem, not the user's
    }
  }

  const reply = raw.replace(ACTION_RE, "").replace(/\n{3,}/g, "\n\n").trim();
  return { reply, applied };
}

/** Validate the user's incoming images. */
function parseImages(images: unknown): StoredImage[] | NextResponse {
  if (images === undefined) return [];
  if (!Array.isArray(images) || images.length > MAX_IMAGES_PER_MSG) {
    return NextResponse.json({ error: "Bad images" }, { status: 400 });
  }
  const clean: StoredImage[] = [];
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
  return clean;
}

export async function POST(req: Request) {
  const guard = await requireRole("editor", req);
  if (guard) return guard;

  const limited = rateLimit(req, "ai", 30, 600);
  if (limited) return limited;

  const session = await getSession();

  let body: { chatId?: unknown; text?: unknown; images?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const chatId = typeof body.chatId === "string" ? body.chatId : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!chatId) {
    return NextResponse.json({ error: "chatId required" }, { status: 400 });
  }
  if (text.length > MAX_LEN) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  const imagesOrErr = parseImages(body.images);
  if (imagesOrErr instanceof NextResponse) return imagesOrErr;
  const images = imagesOrErr;

  if (!text && images.length === 0) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const chat = await readChatAuthorized(chatId, session!.id);
  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  // Stored history (capped) becomes the assistant's memory for this turn.
  const history: ChatMessage[] = chat.messages.slice(-MAX_MESSAGES).map((m) => ({
    role: m.role,
    text: m.text,
    ...(m.images?.length ? { images: m.images } : {}),
  }));
  history.push({
    role: "user",
    text: text || "Подивись на зображення.",
    ...(images.length ? { images } : {}),
  });

  let reply: string;
  let applied: Applied[];
  try {
    const catalog = await buildCatalog();
    const sys = `${SYSTEM_PROMPT}\n\nКаталог текстів сайту (мова|ключ|текст):\n${catalog.text}`;
    const replyRaw = await geminiChat(history, sys);
    ({ reply, applied } = await applyActions(replyRaw, catalog.keys, session));
  } catch (e) {
    if (e instanceof GeminiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI error" },
      { status: 500 },
    );
  }

  // Persist both turns so the conversation (and its memory) survives reloads.
  const now = new Date().toISOString();
  const userMsg: StoredMessage = {
    role: "user",
    text,
    ts: now,
    authorId: session!.id,
    authorName: session!.globalName || session!.username,
    ...(images.length ? { images } : {}),
  };
  chat.messages.push(userMsg, { role: "model", text: reply, ts: now });
  // First user line names an untitled chat.
  if (chat.title === "Новий чат" && text) {
    chat.title = text.slice(0, 48);
  }
  await writeChat(chat);

  return NextResponse.json({ reply, applied, title: chat.title });
}
