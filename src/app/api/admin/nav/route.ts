import { NextResponse } from "next/server";

import { requireOwner } from "@/lib/cms/guard";
import {
  readNavOverrides,
  writeNavOverrides,
  type NavItem,
} from "@/lib/cms/store";

export async function GET() {
  const deny = await requireOwner();
  if (deny) return deny;
  const overrides = await readNavOverrides();
  return NextResponse.json({ overrides });
}

export async function PUT(req: Request) {
  const deny = await requireOwner();
  if (deny) return deny;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const b = body as { navbar?: NavItem[] | null; footer?: NavItem[] | null };
  const next: { navbar?: NavItem[] | null; footer?: NavItem[] | null } = {};
  if ("navbar" in b) next.navbar = Array.isArray(b.navbar) ? b.navbar : null;
  if ("footer" in b) next.footer = Array.isArray(b.footer) ? b.footer : null;
  await writeNavOverrides(next);
  return NextResponse.json({ ok: true, overrides: next });
}
