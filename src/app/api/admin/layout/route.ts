import { NextResponse } from "next/server";

import { requireRole } from "@/lib/cms/guard";
import {
  readLayoutOverrides,
  writeLayoutOverrides,
  type SectionLayout,
} from "@/lib/cms/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireRole("editor");
  if (guard) return guard;
  const data = await readLayoutOverrides();
  return NextResponse.json({ layout: data });
}

/** PUT /api/admin/layout
 *  Body: { page: "landing", sections: string[], hidden: string[] }
 */
export async function PUT(req: Request) {
  const guard = await requireRole("editor", req);
  if (guard) return guard;

  let body: { page?: unknown; sections?: unknown; hidden?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const page = String(body.page || "");
  if (!/^[a-z][a-z0-9_-]*$/.test(page))
    return NextResponse.json({ error: `Bad page: ${page}` }, { status: 400 });

  const sections = Array.isArray(body.sections)
    ? body.sections
        .filter((x): x is string => typeof x === "string")
        .slice(0, 64)
    : undefined;
  const hidden = Array.isArray(body.hidden)
    ? body.hidden
        .filter((x): x is string => typeof x === "string")
        .slice(0, 64)
    : undefined;

  const cur = await readLayoutOverrides();
  const pageLayout: SectionLayout = cur[page] || {};
  if (sections !== undefined) pageLayout.sections = sections;
  if (hidden !== undefined) pageLayout.hidden = hidden;
  cur[page] = pageLayout;
  await writeLayoutOverrides(cur);

  return NextResponse.json({ ok: true, page, layout: pageLayout });
}
