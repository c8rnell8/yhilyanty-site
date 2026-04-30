# yhilyanty-site

Next.js 16 (App Router) trilingual site (UA / RU / EN) for the **Ухилянти** Squad / Arma Reforger clan.

Pairs with the Discord bot [c8rnell8/yhilbot](https://github.com/c8rnell8/yhilbot) — the bot uploads videos to this site via `/api/editor/sessions`, user edits in the browser, bot pulls the rendered GIF/MP4 back.

## Features

- **Landing** with hero, games (Squad / Arma Reforger), gallery, codex, bot promo, CTA
- **Roster** (`/roster`) — operators table
- **Join** (`/join`) — Discord OAuth login + application form
- **Merch** (`/merch`, `/merch/[item]`) — product detail + order form with optional webhook
- **Bot** (`/bot`) — bot commands + install button
- **Admin CMS** (`/admin/*`, owner-only) — edit texts, images, landing section order, dynamic pages, navbar/footer
- **Web editor** (`/editor/[id]`) — trim + text overlay + blur + crop + speed + MP4/GIF/WebM export via ffmpeg

## Stack

- Next.js 16.2.4 (App Router, Server Components)
- next-intl v4 for i18n
- Tailwind CSS + custom color tokens (`#050505` / `#fbbf24` / `#f5f5f4`)
- Phosphor Icons
- ffmpeg (system binary, called from `/api/editor/sessions/:id/render`)
- JSON file storage for CMS overrides in `.cms-overrides/`

## Development

```bash
cp .env.example .env.local
# fill in DISCORD_CLIENT_ID etc.
npm install
npm run dev
```

## Deployment

Build and run:

```bash
npm run build
npm run start
```

See `deploy/` for nginx + systemd configs used in production.

## Env vars

See `.env.example`. All four are required for full functionality:

- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` — OAuth app credentials
- `OWNER_DISCORD_ID` — your Discord user ID; users with this ID see the admin panel
- `SITE_URL` — public base URL (https)
- `YHILBOT_API_TOKEN` — shared secret with the bot
