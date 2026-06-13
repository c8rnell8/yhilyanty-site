import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { AiAssistant } from "@/components/admin/ai-assistant";
import { geminiConfigured } from "@/lib/ai/gemini";
import { getSession } from "@/lib/auth";
import { getRole, roleAtLeast } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function AdminAiRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!roleAtLeast(await getRole(session), "editor")) redirect(`/${locale}/admin`);

  return <AiAssistant locale={locale} configured={geminiConfigured()} />;
}
