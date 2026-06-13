import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { requireRole } from "@/lib/cms/guard";
import {
  deleteChat,
  readChatAuthorized,
  writeChat,
} from "@/lib/ai/chats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — full chat history (only if allowed to see it). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole("editor");
  if (guard) return guard;
  const session = await getSession();
  const chat = await readChatAuthorized((await ctx.params).id, session!.id);
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ chat });
}

/** PATCH { title } — rename. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole("editor", req);
  if (guard) return guard;
  const session = await getSession();
  const chat = await readChatAuthorized((await ctx.params).id, session!.id);
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { title?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const title = String(body.title || "").trim().slice(0, 80);
  if (title) {
    chat.title = title;
    await writeChat(chat);
  }
  return NextResponse.json({ chat });
}

/** DELETE — remove a chat. Private: only the owner. Team: any team member. */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const guard = await requireRole("editor");
  if (guard) return guard;
  const session = await getSession();
  const id = (await ctx.params).id;
  const chat = await readChatAuthorized(id, session!.id);
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteChat(id);
  return NextResponse.json({ ok: true });
}
