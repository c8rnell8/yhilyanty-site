import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getSession } from "@/lib/auth";
import { getRole, roleAtLeast } from "@/lib/roles";
import { LayoutEditor } from "@/components/admin/layout-editor";
import { LANDING_SECTIONS } from "@/lib/cms/sections";
import { readLayoutOverrides } from "@/lib/cms/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Секції лендінгу — Адмінка",
};

export default async function AdminLayoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!roleAtLeast(await getRole(session), "editor")) redirect(`/${locale}/admin`);

  const all = await readLayoutOverrides();
  const landing = all["landing"] || {};
  const savedOrder = Array.isArray(landing.sections) ? landing.sections : [];
  const hidden = new Set(Array.isArray(landing.hidden) ? landing.hidden : []);

  // Start from saved order, drop unknowns, append missing defaults
  const known = new Set(LANDING_SECTIONS.map((s) => s.key));
  const ordered: string[] = [];
  for (const k of savedOrder) if (known.has(k) && !ordered.includes(k)) ordered.push(k);
  for (const s of LANDING_SECTIONS) if (!ordered.includes(s.key)) ordered.push(s.key);

  return (
    <LayoutEditor
      sections={LANDING_SECTIONS}
      initialOrder={ordered}
      initialHidden={Array.from(hidden)}
    />
  );
}
