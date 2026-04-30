import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { applyTextOverrides, readTextOverrides } from "@/lib/cms/store";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const base = (await import(`../messages/${locale}.json`)).default as Record<
    string,
    unknown
  >;

  // Merge admin-edited overrides on top of bundled JSON. Failure is
  // non-fatal: a corrupted overrides file should NOT break the site.
  let messages = base;
  try {
    const all = await readTextOverrides();
    const localeOverrides = all[locale];
    if (localeOverrides && Object.keys(localeOverrides).length > 0) {
      messages = applyTextOverrides(base, localeOverrides) as Record<
        string,
        unknown
      >;
    }
  } catch (e) {
    console.error("i18n:override_load_failed", e);
  }

  return {
    locale,
    messages,
  };
});
