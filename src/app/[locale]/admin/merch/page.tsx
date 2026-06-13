import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { MerchManager } from "@/components/admin/merch-manager";
import { getSession } from "@/lib/auth";
import { getRole, roleAtLeast } from "@/lib/roles";
import { readMerchStore } from "@/lib/cms/store";

export const dynamic = "force-dynamic";

export default async function AdminMerchRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!roleAtLeast(await getRole(session), "admin")) redirect(`/${locale}/admin`);

  const store = await readMerchStore();
  return <MerchManager locale={locale} initial={store.products} />;
}
