import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { SystemPanel } from "@/components/admin/system-panel";
import { readAudit } from "@/lib/audit";
import { getSession, isOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminSystemRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!isOwner(session)) redirect(`/${locale}/admin`);

  return <SystemPanel initialAudit={await readAudit(300)} />;
}
