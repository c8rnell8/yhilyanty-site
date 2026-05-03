import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getSession, isOwner } from "@/lib/auth";
import { ImageManager } from "@/components/admin/image-manager";
import { IMAGE_SLOTS } from "@/lib/cms/slots";
import { readImageOverridesMulti } from "@/lib/cms/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Зображення — Адмінка",
};

export default async function AdminImagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!isOwner(session)) redirect(`/${locale}/admin`);

  const overrides = await readImageOverridesMulti();
  return <ImageManager slots={IMAGE_SLOTS} initialOverrides={overrides} />;
}
