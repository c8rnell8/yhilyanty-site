import { NextResponse } from "next/server";

import { geminiChat, GeminiError } from "@/lib/ai/gemini";
import { requireOwner } from "@/lib/cms/guard";
import { setTextOverride } from "@/lib/cms/store";
import { rateLimit } from "@/lib/rate-limit";
import { routing } from "@/i18n/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCALE_NAMES: Record<string, string> = {
  ua: "Ukrainian",
  ru: "Russian",
  en: "English",
};

const MAX_ITEMS = 25;
const MAX_VALUE = 4000;
const MAX_TOTAL = 15000;

const SYSTEM_PROMPT = `You translate UI strings for the website of the "Ухилянти" gaming clan (Squad / Arma Reforger, military theme).
Rules:
- You get a JSON object; translate every value, keep every key exactly as is.
- TRANSLATE FAITHFULLY. This is translation, not copywriting: keep the exact meaning of the source, sentence by sentence. Never invent, drop or embellish content.
- Preserve placeholders like {name} or {count}, HTML tags, markdown, line breaks and emoji untouched.
- Keep the informal military-community tone of the source. Clan name per language: Ukrainian "Ухилянти", Russian "Ухилянты", English "Yhilyanty".
- Reply with ONLY the JSON object, no code fences, no commentary.`;

function parseModelJson(raw: string): Record<string, string> | null {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "");
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v !== "string") return null;
      out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

/** POST /api/admin/translate
 *  Body: {
 *    from: "ru", to: ["ua","en"],
 *    items: { "Hero.title": "Текст…" },
 *    save?: boolean   // also write the results as text overrides
 *  }
 *  Returns: { translations: { ua: {...}, en: {...} }, overrides?: { ua: {...}, en: {...} } }
 */
export async function POST(req: Request) {
  const guard = await requireOwner(req);
  if (guard) return guard;

  const limited = rateLimit(req, "translate", 30, 600);
  if (limited) return limited;

  let body: { from?: unknown; to?: unknown; items?: unknown; save?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const locales = routing.locales as readonly string[];
  const from = String(body.from || "");
  if (!locales.includes(from)) {
    return NextResponse.json({ error: `Bad source locale: ${from}` }, { status: 400 });
  }

  const to = Array.isArray(body.to)
    ? body.to.map(String).filter((l) => locales.includes(l) && l !== from)
    : [];
  if (to.length === 0) {
    return NextResponse.json({ error: "No target locales" }, { status: 400 });
  }

  if (!body.items || typeof body.items !== "object" || Array.isArray(body.items)) {
    return NextResponse.json({ error: "items required" }, { status: 400 });
  }
  const items: Record<string, string> = {};
  let total = 0;
  for (const [k, v] of Object.entries(body.items as Record<string, unknown>)) {
    if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/.test(k)) {
      return NextResponse.json({ error: `Bad key: ${k}` }, { status: 400 });
    }
    if (typeof v !== "string" || !v.trim()) continue;
    if (v.length > MAX_VALUE) {
      return NextResponse.json({ error: `Value too long for ${k}` }, { status: 400 });
    }
    items[k] = v;
    total += v.length;
  }
  const keys = Object.keys(items);
  if (keys.length === 0) {
    return NextResponse.json({ error: "Nothing to translate" }, { status: 400 });
  }
  if (keys.length > MAX_ITEMS || total > MAX_TOTAL) {
    return NextResponse.json(
      { error: `Too much at once (max ${MAX_ITEMS} items / ${MAX_TOTAL} chars)` },
      { status: 400 },
    );
  }

  const save = body.save === true;
  const translations: Record<string, Record<string, string>> = {};
  const overrides: Record<string, Record<string, string>> = {};

  for (const target of to) {
    const prompt = `Translate from ${LOCALE_NAMES[from]} to ${LOCALE_NAMES[target]}:\n${JSON.stringify(items)}`;
    let reply: string;
    try {
      reply = await geminiChat([{ role: "user", text: prompt }], SYSTEM_PROMPT, {
        temperature: 0.1,
      });
    } catch (e) {
      if (e instanceof GeminiError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }
    const parsed = parseModelJson(reply);
    if (!parsed) {
      return NextResponse.json(
        { error: "Перекладач повернув невалідну відповідь, спробуй ще раз." },
        { status: 502 },
      );
    }
    const clean: Record<string, string> = {};
    for (const k of keys) {
      const v = parsed[k];
      if (typeof v === "string" && v.trim()) clean[k] = v.slice(0, MAX_VALUE);
    }
    translations[target] = clean;

    if (save) {
      let updated: Awaited<ReturnType<typeof setTextOverride>> | null = null;
      for (const [k, v] of Object.entries(clean)) {
        updated = await setTextOverride(target, k, v);
      }
      if (updated) overrides[target] = updated[target] || {};
    }
  }

  return NextResponse.json(
    save ? { translations, overrides } : { translations },
  );
}
