import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getSession, isOwner } from "@/lib/auth";
import { ContentEditor } from "@/components/admin/content-editor";
import { flattenMessages, readTextOverrides } from "@/lib/cms/store";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Тексти — Адмінка",
};

export default async function AdminContentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!isOwner(session)) redirect(`/${locale}/admin`);

  const defaults: Record<string, Record<string, string>> = {};
  for (const lc of routing.locales) {
    const base = (await import(`../../../../messages/${lc}.json`)).default;
    defaults[lc] = flattenMessages(base);
  }
  const overrides = await readTextOverrides();

  return (
    <ContentEditor
      locale={locale}
      locales={[...routing.locales]}
      defaults={defaults}
      initialOverrides={overrides}
    />
  );
}
