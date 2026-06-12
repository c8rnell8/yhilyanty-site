import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { NavEditor } from "@/components/admin/nav-editor";
import { getSession } from "@/lib/auth";
import { getRole, roleAtLeast } from "@/lib/roles";
import { readNavOverrides, readPagesStore } from "@/lib/cms/store";
import { DEFAULT_NAVBAR_IDS } from "@/lib/cms/nav";

export const dynamic = "force-dynamic";

export default async function AdminNavRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!roleAtLeast(await getRole(session), "editor")) redirect(`/${locale}/admin`);

  const overrides = await readNavOverrides();
  const pagesStore = await readPagesStore();
  const defaultHrefs = DEFAULT_NAVBAR_IDS.map((d) => ({
    href: d.href,
    key: d.key,
  }));
  const customPages = pagesStore.pages.map((p) => ({
    slug: p.slug,
    name: p.title.ua || p.title.ru || p.title.en || p.slug,
  }));
  return (
    <NavEditor
      initialOverrides={overrides}
      defaultHrefs={defaultHrefs}
      customPages={customPages}
    />
  );
}
