import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { TeamPanel } from "@/components/admin/team-panel";
import { getSession } from "@/lib/auth";
import { getRole, roleAtLeast } from "@/lib/roles";
import { readTeamStore } from "@/lib/cms/store";

export const dynamic = "force-dynamic";

export default async function AdminTeamRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!roleAtLeast(await getRole(session), "owner")) redirect(`/${locale}/admin`);

  const store = await readTeamStore();
  return <TeamPanel locale={locale} initialMembers={store.members} />;
}
