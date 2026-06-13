import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

import { CMS_DIR } from "@/lib/cms/store";

/** Persistent AI chats. Each chat is its own JSON file so concurrent writers
 *  to different chats never block each other.
 *
 *  - private chats: owned by one Discord id, only that person sees them.
 *  - shared chats:  scope "team", any team member can read and continue them.
 *
 *  The stored message history IS the assistant's memory - we replay it to
 *  Gemini on every turn. */

export const CHATS_DIR = path.join(CMS_DIR, "ai-chats");

export type ChatScope = "private" | "team";
export type StoredRole = "user" | "model";

export type StoredImage = { mimeType: string; data: string };
export type StoredMessage = {
  role: StoredRole;
  text: string;
  images?: StoredImage[];
  ts: string;
  authorId?: string; // who sent this user turn (useful in shared chats)
  authorName?: string;
};

export type Chat = {
  id: string;
  scope: ChatScope;
  ownerId: string | null; // null for team chats
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
};

export type ChatSummary = {
  id: string;
  scope: ChatScope;
  ownerId: string | null;
  title: string;
  updatedAt: string;
  messageCount: number;
};

const MAX_MESSAGES = 200;
const ID_RE = /^chat_[a-f0-9]{16}$/;

function chatPath(id: string): string {
  if (!ID_RE.test(id)) throw new Error("bad chat id");
  return path.join(CHATS_DIR, `${id}.json`);
}

export function newChatId(): string {
  return `chat_${crypto.randomBytes(8).toString("hex")}`;
}

export function isValidChatId(id: string): boolean {
  return ID_RE.test(id);
}

export async function readChat(id: string): Promise<Chat | null> {
  if (!isValidChatId(id)) return null;
  try {
    const raw = await fs.readFile(chatPath(id), "utf8");
    return JSON.parse(raw) as Chat;
  } catch {
    return null;
  }
}

export async function writeChat(chat: Chat): Promise<void> {
  await fs.mkdir(CHATS_DIR, { recursive: true });
  // Keep memory bounded - drop the oldest turns past the cap.
  if (chat.messages.length > MAX_MESSAGES) {
    chat.messages = chat.messages.slice(-MAX_MESSAGES);
  }
  chat.updatedAt = new Date().toISOString();
  const tmp = `${chatPath(chat.id)}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(chat), "utf8");
  await fs.rename(tmp, chatPath(chat.id));
}

export async function deleteChat(id: string): Promise<void> {
  if (!isValidChatId(id)) return;
  await fs.unlink(chatPath(id)).catch(() => {});
}

/** Chats a given user may see: their own private ones plus every team chat. */
export async function listChatsFor(userId: string): Promise<ChatSummary[]> {
  await fs.mkdir(CHATS_DIR, { recursive: true });
  const names = await fs.readdir(CHATS_DIR);
  const out: ChatSummary[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const chat = JSON.parse(
        await fs.readFile(path.join(CHATS_DIR, name), "utf8"),
      ) as Chat;
      if (chat.scope === "team" || chat.ownerId === userId) {
        out.push({
          id: chat.id,
          scope: chat.scope,
          ownerId: chat.ownerId,
          title: chat.title,
          updatedAt: chat.updatedAt,
          messageCount: chat.messages.length,
        });
      }
    } catch {
      // skip unreadable file
    }
  }
  out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return out;
}

/** Read a chat only if this user is allowed to see it. */
export async function readChatAuthorized(
  id: string,
  userId: string,
): Promise<Chat | null> {
  const chat = await readChat(id);
  if (!chat) return null;
  if (chat.scope === "team") return chat;
  return chat.ownerId === userId ? chat : null;
}
