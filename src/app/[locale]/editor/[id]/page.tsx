import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { readSession } from "@/lib/editor/session";
import { Editor } from "@/components/editor/editor";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "Editor" });
  return { title: `${t("title")} · ${id} — Ухилянти` };
}

export default async function EditorPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const s = await readSession(id);
  if (!s) notFound();
  const t = await getTranslations({ locale, namespace: "Editor" });

  const strings = {
    title: t("title"),
    sessionId: t("sessionId"),
    timeline: t("timeline"),
    inPoint: t("inPoint"),
    outPoint: t("outPoint"),
    captions: t("captions"),
    addCaption: t("addCaption"),
    captionText: t("captionText"),
    captionColor: t("captionColor"),
    captionSize: t("captionSize"),
    captionBackground: t("captionBackground"),
    bgNone: t("bgNone"),
    bgBlack: t("bgBlack"),
    bgWhite: t("bgWhite"),
    bgYellow: t("bgYellow"),
    blurs: t("blurs"),
    addBlur: t("addBlur"),
    blurIntensity: t("blurIntensity"),
    crop: t("crop"),
    enableCrop: t("enableCrop"),
    cropX: t("cropX"),
    cropY: t("cropY"),
    cropW: t("cropW"),
    cropH: t("cropH"),
    speed: t("speed"),
    output: t("output"),
    format: t("format"),
    formatMp4: t("formatMp4"),
    formatGif: t("formatGif"),
    formatWebp: t("formatWebp"),
    fps: t("fps"),
    maxWidth: t("maxWidth"),
    render: t("render"),
    rendering: t("rendering"),
    rendered: t("rendered"),
    failed: t("failed"),
    download: t("download"),
    copyLink: t("copyLink"),
    linkCopied: t("linkCopied"),
    discardChanges: t("discardChanges"),
    duration: t("duration"),
    resolution: t("resolution"),
    fpsLabel: t("fpsLabel"),
    sourceFile: t("sourceFile"),
    statusUploaded: t("statusUploaded"),
    statusEditing: t("statusEditing"),
    statusRendering: t("statusRendering"),
    statusRendered: t("statusRendered"),
    statusFailed: t("statusFailed"),
    botWillSendBack: t("botWillSendBack"),
    remove: t("remove"),
    posX: t("posX"),
    posY: t("posY"),
    width: t("width"),
    height: t("height"),
    seek: t("seek"),
    play: t("play"),
    pause: t("pause"),
    panel: t("panel"),
    panelTrim: t("panelTrim"),
    panelText: t("panelText"),
    panelBlur: t("panelBlur"),
    panelCrop: t("panelCrop"),
    panelSpeed: t("panelSpeed"),
    panelOutput: t("panelOutput"),
    discordLimit: t("discordLimit"),
    tooLargeHint: t("tooLargeHint"),
    estimateHint: t("estimateHint"),
    backToHome: t("backToHome"),
  };

  return (
    <Editor
      sessionId={id}
      source={s.source}
      origin={s.origin}
      initialStatus={s.status}
      initialOutputExt={s.output?.ext || null}
      strings={strings}
    />
  );
}
