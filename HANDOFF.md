# Ops notes

Notes on how this thing is deployed and run, so I don't have to remember it all. If someone else ends up maintaining it, start here.

## What it is

A trilingual (UA / RU / EN) site for the Ухилянти clan (Squad / Arma Reforger) with an admin CMS and a browser video editor that talks to a Discord bot. Clan name changes per locale: UA "Ухилянти", RU "Ухилянты", EN "Yhilyanty".

Two repos work together:

- [`c8rnell8/yhilyanty-site`](https://github.com/c8rnell8/yhilyanty-site) — this one. Next.js 16 (App Router) + admin CMS + video editor + REST API. Lives at https://yhil.duckdns.org.
- [`c8rnell8/yhilbot`](https://github.com/c8rnell8/yhilbot) — the Python (discord.py) bot. Commands: `/gif`, `/caption`, `/edit`, `/webedit`, `/stats`, `/help`. `/webedit` uploads a video to the site, you edit it in the browser, then it pulls the render back into Discord.

## Stack

- Frontend: Next.js 16.2.4 App Router, React 19, TypeScript, Tailwind, Phosphor Icons, Framer Motion
- i18n: `next-intl` v4, locales `ua` / `ru` / `en`
- Auth: Discord OAuth2 with an HTTP-only session cookie; admin is gated owner-only via `OWNER_DISCORD_ID`
- CMS storage: plain JSON in `.cms-overrides/` (text/image/layout overrides, dynamic pages, nav/footer)
- Editor: ffmpeg, driven from `src/app/api/editor/sessions/[id]/render/route.ts`, sessions under `.editor-sessions/<id>/`
- Bot: Python 3.11, discord.py 2.7, aiohttp, ffmpeg

## The server

- IP `45.12.62.204`, host `cornflower-iron.mhost.ee` (mhost.ee)
- Debian 12, 1 CPU / 2 GB RAM / 24 GB disk
- Domain `yhil.duckdns.org` (free DuckDNS subdomain), TLS via Let's Encrypt (certbot.timer auto-renews)
- Site runs as `yhilyanty-site.service` → `npm run start -p 3000`, behind nginx, code at `/opt/yhilyanty-site/`
- Bot runs as `yhilbot.service` → `/opt/yhilbot/.venv/bin/python bot.py`, code at `/opt/yhilbot/`
- nginx config in `/etc/nginx/sites-available/yhilyanty` + `/etc/nginx/conf.d/ratelimit.conf`
- fail2ban jails: `sshd`, `nginx-auth-abuse`, `nginx-limit-req`, `nginx-bad-bots` (in `/etc/fail2ban/jail.d/custom.conf`)
- CrowdSec iptables bouncer on top, `unattended-upgrades` for security patches, ufw only allows 22/80/443

## Credentials

Nothing secret is committed. Where everything lives:

- SSH: key at `/home/ubuntu/yhil-server-key` on the deploy host, public key in the server's `/root/.ssh/authorized_keys`. Root password is the fallback and only kept in the password manager.
- Discord OAuth + bot share one app: https://discord.com/developers/applications/1497897295264612372 (`DISCORD_CLIENT_ID = 1497897295264612372`). Callback `https://yhil.duckdns.org/api/auth/callback`. `DISCORD_CLIENT_SECRET` is in `/opt/yhilyanty-site/.env.production` (chmod 600), `DISCORD_TOKEN` in `/opt/yhilbot/yhil.env` (chmod 600), `OWNER_ID = 546710148144562176`.
- Bot ↔ site shared secret: `YHILBOT_API_TOKEN` (a `yhil_`-prefixed hex string from `openssl rand -hex 32`). Site reads it as `YHILBOT_API_TOKEN`, bot as `WEB_EDITOR_TOKEN` — they must match.
- `SESSION_SECRET` signs the login cookie (any `openssl rand -hex 32` string). If unset the site falls back to `DISCORD_CLIENT_SECRET`, so old deployments keep working, but set it anyway — then you can rotate the OAuth secret without logging everyone out.
- DuckDNS token is only in the DuckDNS account.
- There's a Cloudflare zone for `yhil.duckdns.org` but it's stuck `pending` — DuckDNS won't let you change nameservers, so the CF proxy is off. The server-side hardening (fail2ban + CrowdSec + nginx rate limits) covers for it. To actually use CF, buy a real domain and point it at the same CF account.

## Status (2026-04-30)

Site, HTTPS, the hardening stack, OAuth login, the admin CMS, and the video editor are all live. The bot is deployed and configured at `/opt/yhilbot/` but the service is **not started** — leave it that way until the owner explicitly says to start it ("ботом вообще не заходи на дискорд сервера без моей команды"). Still pending: the owner needs to delete the old bot app (client `1499028032952733886`) in the Developer Portal, and Cloudflare's proxy stays off until there's a real domain.

## Starting the bot

Once the owner says go:

```bash
ssh -i /home/ubuntu/yhil-server-key root@45.12.62.204 \
  'systemctl enable --now yhilbot.service && journalctl -u yhilbot.service -n 30 --no-pager'
```

Logs should show the ready line. Auth errors mean the token in `yhil.env` is stale — reset it in the Developer Portal under Bot → Reset Token.

## Deploying updates

Site:

```bash
ssh -i /home/ubuntu/yhil-server-key root@45.12.62.204 'bash -s' <<'EOF'
cd /opt/yhilyanty-site
git pull
npm ci
npm run build
systemctl restart yhilyanty-site
EOF
```

Bot:

```bash
ssh -i /home/ubuntu/yhil-server-key root@45.12.62.204 'bash -s' <<'EOF'
cd /opt/yhilbot
git pull
.venv/bin/pip install -r requirements.txt
systemctl restart yhilbot
EOF
```

`/opt/yhilyanty-site` and `/opt/yhilbot` were originally laid down from tarballs, so `git pull` only works after wiring up the remote once:

```bash
cd /opt/yhilyanty-site && git init && git remote add origin https://github.com/c8rnell8/yhilyanty-site.git && git fetch && git reset --hard origin/main
cd /opt/yhilbot && git init && git remote add origin https://github.com/c8rnell8/yhilbot.git && git fetch && git reset --hard origin/main
```

## Useful commands

Logs:

```bash
ssh -i /home/ubuntu/yhil-server-key root@45.12.62.204 'journalctl -u yhilyanty-site -n 50 --no-pager'
ssh -i /home/ubuntu/yhil-server-key root@45.12.62.204 'journalctl -u yhilbot -n 50 --no-pager'
ssh -i /home/ubuntu/yhil-server-key root@45.12.62.204 'tail -n 100 /var/log/nginx/access.log'
```

Banned IPs:

```bash
ssh -i /home/ubuntu/yhil-server-key root@45.12.62.204 'fail2ban-client status sshd; fail2ban-client status nginx-auth-abuse; cscli decisions list'
```

If you ban yourself (easy to do while tightening SSH/fail2ban/firewall — whitelist first next time):

```bash
MY_IP=$(curl -sS https://api.ipify.org)
ssh -i /home/ubuntu/yhil-server-key root@45.12.62.204 "
fail2ban-client set sshd addignoreip $MY_IP
fail2ban-client set nginx-auth-abuse addignoreip $MY_IP
fail2ban-client set nginx-limit-req addignoreip $MY_IP
fail2ban-client set nginx-bad-bots addignoreip $MY_IP
fail2ban-client unban --all
cscli decisions delete --ip $MY_IP
"
```

Rotating `YHILBOT_API_TOKEN`: change it on both sides (`/opt/yhilyanty-site/.env.production` and `/opt/yhilbot/yhil.env`, both chmod 600) and restart both services.

## Layout

```
yhilyanty-site/
├── README.md            intro
├── HANDOFF.md           this file
├── MIGRATION.md         moving to another VPS
├── .env.example         env template
├── deploy/              nginx, systemd, fail2ban configs
├── public/              static assets
└── src/
    ├── app/
    │   ├── [locale]/
    │   │   ├── page.tsx           landing
    │   │   ├── join/ roster/ merch/ bot/
    │   │   ├── admin/             owner-only CMS, server-gated
    │   │   │   ├── content/       translations
    │   │   │   ├── images/        image slots
    │   │   │   ├── layout-editor/ reorder landing sections
    │   │   │   ├── pages/         dynamic /p/<slug> pages
    │   │   │   └── nav/           navbar + footer
    │   │   ├── editor/[id]/       video editor UI
    │   │   └── p/[slug]/          rendered dynamic pages
    │   └── api/
    │       ├── auth/              Discord OAuth
    │       ├── admin/             CMS writes, owner-only
    │       ├── cms/images/[file]/ CMS image serving
    │       ├── editor/sessions/   editor sessions API
    │       └── merch/order/       merch orders
    ├── components/
    ├── i18n/
    ├── messages/                  ua.json, ru.json, en.json
    ├── lib/                       cms helpers, auth, editor session model
    └── middleware.ts              next-intl + auth
```

`.cms-overrides/` at the project root is gitignored — it's the live CMS data on the server. Back it up now and then (see MIGRATION.md).

## Not done yet

- Cloudflare proxy (needs a real domain to get around the DuckDNS nameserver issue)
- captcha is on `/api/merch/order`; the admin forms are still just rate-limited
- automated backups of `.cms-overrides/` (cron to S3 or wherever)
- proper CI/CD — deploys are still manual git pull / scp
- uptime monitoring
