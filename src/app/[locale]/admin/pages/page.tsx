import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { PagesList } from "@/components/admin/pages-list";
import { getSession } from "@/lib/auth";
import { getRole, roleAtLeast } from "@/lib/roles";
import { readPagesStore } from "@/lib/cms/store";

export const dynamic = "force-dynamic";

export default async function AdminPagesIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!roleAtLeast(await getRole(session), "editor")) redirect(`/${locale}/admin`);

  const store = await readPagesStore();
  return <PagesList initialPages={store.pages} />;
}
