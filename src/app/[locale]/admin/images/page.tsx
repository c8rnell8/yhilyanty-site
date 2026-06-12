import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getSession } from "@/lib/auth";
import { getRole, roleAtLeast } from "@/lib/roles";
import { ImageManager } from "@/components/admin/image-manager";
import { IMAGE_SLOTS } from "@/lib/cms/slots";
import { readImageOverrides } from "@/lib/cms/store";

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
  if (!roleAtLeast(await getRole(session), "editor")) redirect(`/${locale}/admin`);

  const overrides = await readImageOverrides();
  return <ImageManager slots={IMAGE_SLOTS} initialOverrides={overrides} />;
}
