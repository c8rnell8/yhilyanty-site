import { NextResponse } from "next/server";

import { requireRole } from "@/lib/cms/guard";
import {
  flattenMessages,
  readTextOverrides,
  setTextOverride,
} from "@/lib/cms/store";
import { routing } from "@/i18n/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/content?locale=ua
 *  Returns: {
 *    locale, defaults: { dotted.key: string }, overrides: { dotted.key: string }
 *  }
 *  If no locale param — returns map for ALL locales:
 *  { locales: ["ua","ru","en"], defaults: {ua:{},ru:{},en:{}}, overrides: {...} }
 */
export async function GET(req: Request) {
  const guard = await requireRole("editor");
  if (guard) return guard;

  const url = new URL(req.url);
  const single = url.searchParams.get("locale");
  const overrides = await readTextOverrides();

  if (single && routing.locales.includes(single as (typeof routing.locales)[number])) {
    const base = (await import(`../../../../messages/${single}.json`)).default;
    const flat = flattenMessages(base);
    return NextResponse.json({
      locale: single,
      defaults: flat,
      overrides: overrides[single] || {},
    });
  }

  const defaults: Record<string, Record<string, string>> = {};
  for (const lc of routing.locales) {
    const base = (await import(`../../../../messages/${lc}.json`)).default;
    defaults[lc] = flattenMessages(base);
  }
  return NextResponse.json({
    locales: [...routing.locales],
    defaults,
    overrides,
  });
}

/** PUT /api/admin/content
 *  Body: { locale: "ua", key: "Hero.title", value: "..." | null }
 */
export async function PUT(req: Request) {
  const guard = await requireRole("editor", req);
  if (guard) return guard;

  let body: { locale?: unknown; key?: unknown; value?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const locale = String(body.locale || "");
  const key = String(body.key || "");
  if (!routing.locales.includes(locale as (typeof routing.locales)[number]))
    return NextResponse.json(
      { error: `Bad locale: ${locale}` },
      { status: 400 }
    );
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/.test(key))
    return NextResponse.json(
      { error: `Bad key: ${key}` },
      { status: 400 }
    );
  const value =
    body.value === null || body.value === undefined ? null : String(body.value);
  if (value !== null && value.length > 4000)
    return NextResponse.json(
      { error: "Value too long (max 4000 chars)" },
      { status: 400 }
    );

  const updated = await setTextOverride(locale, key, value);
  return NextResponse.json({
    ok: true,
    locale,
    key,
    value,
    overrides: updated[locale] || {},
  });
}
