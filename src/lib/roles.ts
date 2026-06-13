import { isOwner, type Session } from "@/lib/auth";
import { readTeamStore } from "@/lib/cms/store";

/** Who can do what in the admin panel:
 *  - developer — the site developer (Roman). Top power, set via env, not
 *                assignable. Different title, same rights as owner.
 *  - owner     — the clan owner. Top power, assignable by a developer/owner.
 *  - admin     — content tools + merch + orders.
 *  - editor    — content tools (texts, images, pages, nav, layout, AI).
 *  developer and owner are equal at the top; everything gated at "owner"
 *  is open to both.
 */
export type Role = "developer" | "owner" | "admin" | "editor";

const LEVEL: Record<Role, number> = {
  editor: 1,
  admin: 2,
  owner: 3,
  developer: 3,
};

export async function getRole(session: Session | null): Promise<Role | null> {
  if (!session) return null;
  if (isOwner(session)) return "developer"; // Roman, via OWNER_DISCORD_ID
  const team = await readTeamStore();
  const member = team.members.find((m) => m.id === session.id);
  return member ? member.role : null;
}

export function roleAtLeast(role: Role | null, min: Role): boolean {
  if (!role) return false;
  return LEVEL[role] >= LEVEL[min];
}
