import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

function isHttpsRequest(request: NextRequest): boolean {
  // SITE_URL wins over x-forwarded-proto. Some tunnels (devinapps.com)
  // terminate TLS and then forward as plain HTTP with x-forwarded-proto: http,
  // which fools next-intl into emitting http:// redirects to a https-only port.
  const siteUrl = process.env.SITE_URL || "";
  if (siteUrl.startsWith("https://")) {
    const host = request.headers.get("host") || "";
    try {
      const u = new URL(siteUrl);
      if (u.host === host || u.hostname === host.split(":")[0]) return true;
    } catch {
      // fall through to xfp check
    }
  }
  const xfp = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  if (xfp) return xfp === "https";
  return request.nextUrl.protocol === "https:";
}

function rewriteToHttps(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol === "http:") {
      u.protocol = "https:";
      if (u.port === "443" || u.port === "80") u.port = "";
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

export default function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  if (!(response instanceof NextResponse)) return response;

  if (!isHttpsRequest(request)) return response;

  const location = response.headers.get("location");
  if (location) {
    const fixed = rewriteToHttps(location);
    if (fixed !== location) response.headers.set("location", fixed);
  }

  const link = response.headers.get("link");
  if (link) {
    const fixed = link.replace(
      /<http:\/\/([^/>]+?)(?::(?:80|443))?(\/[^>]*)>/g,
      "<https://$1$2>",
    );
    if (fixed !== link) response.headers.set("link", fixed);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
