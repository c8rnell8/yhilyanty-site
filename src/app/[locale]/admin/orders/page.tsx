import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getSession, isOwner } from "@/lib/auth";
import { OrdersList } from "@/components/admin/orders-list";
import { readMerchOrders } from "@/lib/cms/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Замовлення — Адмінка",
};

export default async function AdminOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!isOwner(session)) redirect(`/${locale}/admin`);

  const orders = await readMerchOrders();
  return <OrdersList initialOrders={orders} />;
}
