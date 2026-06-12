import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { PageEditor } from "@/components/admin/page-editor";
import { getSession } from "@/lib/auth";
import { getRole, roleAtLeast } from "@/lib/roles";
import { findPageById } from "@/lib/cms/store";

export const dynamic = "force-dynamic";

export default async function AdminPageEditorRoute({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!roleAtLeast(await getRole(session), "editor")) redirect(`/${locale}/admin`);

  const page = await findPageById(id);
  if (!page) notFound();

  return <PageEditor initialPage={page} />;
}
