import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { OrdersPanel } from "@/components/admin/orders-panel";
import { getSession, isOwner } from "@/lib/auth";
import { readOrdersStore } from "@/lib/cms/store";

export const dynamic = "force-dynamic";

export default async function AdminOrdersRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!isOwner(session)) redirect(`/${locale}/admin`);

  const store = await readOrdersStore();
  return <OrdersPanel initialOrders={store.orders} />;
}
