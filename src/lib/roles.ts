import { isOwner, type Session } from "@/lib/auth";
import { readTeamStore } from "@/lib/cms/store";

/** Who can do what in the admin panel:
 *  - owner  — everything, including handing out roles
 *  - admin  — all content tools + merch orders
 *  - editor — content tools (texts, images, pages, nav, layout, AI)
 */
export type Role = "owner" | "admin" | "editor";

const LEVEL: Record<Role, number> = { editor: 1, admin: 2, owner: 3 };

export async function getRole(session: Session | null): Promise<Role | null> {
  if (!session) return null;
  if (isOwner(session)) return "owner";
  const team = await readTeamStore();
  const member = team.members.find((m) => m.id === session.id);
  return member ? member.role : null;
}

export function roleAtLeast(role: Role | null, min: Role): boolean {
  if (!role) return false;
  return LEVEL[role] >= LEVEL[min];
}
