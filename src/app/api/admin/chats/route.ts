import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { requireRole } from "@/lib/cms/guard";
import {
  listChatsFor,
  newChatId,
  writeChat,
  type Chat,
  type ChatScope,
} from "@/lib/ai/chats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — chats this team member can see (own private + all team chats). */
export async function GET() {
  const guard = await requireRole("editor");
  if (guard) return guard;
  const session = await getSession();
  return NextResponse.json({ chats: await listChatsFor(session!.id) });
}

/** POST { scope, title } — start a new chat. */
export async function POST(req: Request) {
  const guard = await requireRole("editor", req);
  if (guard) return guard;
  const session = await getSession();

  let body: { scope?: unknown; title?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const scope: ChatScope = body.scope === "team" ? "team" : "private";
  const title = String(body.title || "Новий чат").slice(0, 80);
  const now = new Date().toISOString();
  const chat: Chat = {
    id: newChatId(),
    scope,
    ownerId: scope === "team" ? null : session!.id,
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  await writeChat(chat);
  return NextResponse.json({ chat }, { status: 201 });
}
