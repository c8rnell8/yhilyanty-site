import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { SystemPanel } from "@/components/admin/system-panel";
import { readAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { getRole, roleAtLeast } from "@/lib/roles";
import { listSnapshots } from "@/lib/backup";

export const dynamic = "force-dynamic";

export default async function AdminSystemRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!roleAtLeast(await getRole(session), "owner")) redirect(`/${locale}/admin`);

  return (
    <SystemPanel
      locale={locale}
      initialAudit={await readAudit(1000)}
      initialSnapshots={await listSnapshots()}
    />
  );
}
