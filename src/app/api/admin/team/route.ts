import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { requireRole } from "@/lib/cms/guard";
import {
  readTeamStore,
  removeTeamMember,
  upsertTeamMember,
  type TeamRole,
} from "@/lib/cms/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES: TeamRole[] = ["owner", "admin", "editor"];
const MAX_MEMBERS = 50;

/** Only owner/developer manage the team - admins and editors can't touch
 *  roles, so nobody can promote themselves or anyone else. */

export async function GET() {
  const guard = await requireRole("owner");
  if (guard) return guard;
  return NextResponse.json(await readTeamStore());
}

export async function POST(req: Request) {
  const guard = await requireRole("owner", req);
  if (guard) return guard;

  let body: { id?: unknown; name?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = String(body.id || "").trim();
  if (!/^\d{17,20}$/.test(id)) {
    return NextResponse.json(
      { error: "Discord ID — це число з 17–20 цифр" },
      { status: 400 },
    );
  }
  const session = await getSession();
  if (session && id === session.id) {
    return NextResponse.json(
      { error: "Власнику роль не потрібна — у тебе і так повний доступ" },
      { status: 400 },
    );
  }
  const role = body.role as TeamRole;
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Bad role" }, { status: 400 });
  }
  const name = String(body.name || "").trim().slice(0, 100);

  const store = await readTeamStore();
  if (
    store.members.length >= MAX_MEMBERS &&
    !store.members.find((m) => m.id === id)
  ) {
    return NextResponse.json(
      { error: `Занадто багато учасників (max ${MAX_MEMBERS})` },
      { status: 400 },
    );
  }

  const updated = await upsertTeamMember({
    id,
    name,
    role,
    addedAt: new Date().toISOString(),
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const guard = await requireRole("owner", req);
  if (guard) return guard;
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  if (!/^\d{17,20}$/.test(id)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }
  return NextResponse.json(await removeTeamMember(id));
}
