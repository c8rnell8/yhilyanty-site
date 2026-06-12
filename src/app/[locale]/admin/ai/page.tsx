import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { AiAssistant } from "@/components/admin/ai-assistant";
import { geminiConfigured } from "@/lib/ai/gemini";
import { getSession, isOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminAiRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!isOwner(session)) redirect(`/${locale}/admin`);

  return <AiAssistant configured={geminiConfigured()} />;
}
