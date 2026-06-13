import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework (minor info-disclosure hardening).
  poweredByHeader: false,
  // Self-contained server bundle — only for the hardened Docker image, which
  // sets NEXT_STANDALONE=1. Off for the classic `npm run start` deploy so the
  // tracer doesn't try to bundle live .cms-overrides data.
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // No embedding in iframes - kills clickjacking on the admin panel.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // Defence-in-depth against XSS / data exfiltration. Kept compatible
          // with Next.js inline runtime, hCaptcha and Discord CDN avatars;
          // forms can only post back to us, nothing can frame us, no plugins.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "img-src 'self' data: blob: https://cdn.discordapp.com",
              "media-src 'self' blob:",
              "style-src 'self' 'unsafe-inline'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://hcaptcha.com https://*.hcaptcha.com",
              "frame-src https://hcaptcha.com https://*.hcaptcha.com",
              "connect-src 'self' https://hcaptcha.com https://*.hcaptcha.com https://generativelanguage.googleapis.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "object-src 'none'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
