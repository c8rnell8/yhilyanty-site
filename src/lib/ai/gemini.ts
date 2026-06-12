/** Thin server-side wrapper around the Google Gemini REST API.
 *
 * Free tier: get a key at https://aistudio.google.com/apikey and put it in
 * GEMINI_API_KEY. No billing required. We talk to the REST endpoint directly
 * so there's no SDK dependency to keep in sync.
 */

export type ChatRole = "user" | "model";
export type ChatMessage = { role: ChatRole; text: string };

// The -latest alias tracks whatever lite model Google currently serves on
// the free tier, so the site keeps working when they rotate models. The
// rest are fallbacks for when a model is overloaded or loses free quota.
const MODEL_CANDIDATES = [
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
];

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

export type GeminiOptions = {
  /** 0 = literal, 1 = creative. Chat wants ~0.7, translation wants ~0.1. */
  temperature?: number;
};

async function callModel(
  key: string,
  model: string,
  history: ChatMessage[],
  systemPrompt?: string,
  opts?: GeminiOptions,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const body: Record<string, unknown> = {
    contents: history.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
    generationConfig: {
      temperature: opts?.temperature ?? 0.7,
      maxOutputTokens: 2048,
    },
  };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new GeminiError(
      `Не вдалося звʼязатися з Gemini: ${e instanceof Error ? e.message : String(e)}`,
      502,
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    let msg = `Gemini повернув ${res.status}`;
    try {
      const j = JSON.parse(detail);
      if (j?.error?.message) msg = j.error.message;
    } catch {
      if (detail) msg = detail.slice(0, 300);
    }
    const status =
      res.status === 429 || res.status === 503 || res.status === 404
        ? res.status
        : 502;
    throw new GeminiError(msg, status);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
  };

  if (data.promptFeedback?.blockReason) {
    throw new GeminiError(
      `Запит заблоковано Gemini (${data.promptFeedback.blockReason}).`,
      400,
    );
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new GeminiError("Gemini повернув порожню відповідь.", 502);
  }
  return text;
}

/** Send a chat turn (with prior history) and return the model's reply text.
 *  Falls through the candidate models when one is overloaded or has no
 *  free quota, so the owner never has to touch this. */
export async function geminiChat(
  history: ChatMessage[],
  systemPrompt?: string,
  opts?: GeminiOptions,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new GeminiError(
      "GEMINI_API_KEY не налаштований. Додай ключ у .env.local (безкоштовно на aistudio.google.com/apikey).",
      503,
    );
  }
  const models = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL, ...MODEL_CANDIDATES]
    : MODEL_CANDIDATES;

  let lastErr: GeminiError | null = null;
  for (const model of models) {
    try {
      return await callModel(key, model, history, systemPrompt, opts);
    } catch (e) {
      if (
        e instanceof GeminiError &&
        (e.status === 429 || e.status === 503 || e.status === 404)
      ) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new GeminiError("Gemini недоступний.", 502);
}
