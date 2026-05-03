import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getSession, isOwner } from "@/lib/auth";
import { MerchManager } from "@/components/admin/merch-manager";
import { DEFAULT_MERCH_IDS, readMerchStore } from "@/lib/cms/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Каталог мерчу — Адмінка",
};

export default async function AdminMerchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!isOwner(session)) redirect(`/${locale}/admin`);

  const store = await readMerchStore();
  return (
    <MerchManager initialItems={store.items} defaultIds={DEFAULT_MERCH_IDS} />
  );
}
