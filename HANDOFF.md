# yhilyanty-site — Handoff Document

> **Purpose**: this document is for any future operator (AI or human) who needs to continue, debug, or extend this project. It assumes zero prior context — read top to bottom.

## 1. What this project is

A trilingual (Ukrainian / Russian / English) website for the **Ухилянти** clan (Squad / Arma Reforger), with an integrated admin CMS and a video-editor that pairs with a Discord bot. The clan name varies by locale: UA "Ухилянти", RU "Ухилянты", EN "Yhilyanty".

There are **two repositories** that work together:

- [`c8rnell8/yhilyanty-site`](https://github.com/c8rnell8/yhilyanty-site) — this repo. Next.js 16 (App Router) frontend + admin CMS + video editor + REST API. Deployed at `https://yhil.duckdns.org`.
- [`c8rnell8/yhilbot`](https://github.com/c8rnell8/yhilbot) — Python Discord bot (discord.py). Provides `/gif`, `/caption`, `/edit`, `/webedit`, `/stats`, `/help`. The `/webedit` command uploads videos to this site so the user can edit them in the browser, then pulls the rendered output back to Discord.

## 2. Tech stack

| Component | Stack |
|-----------|-------|
| Frontend | Next.js 16.2.4 App Router, React 19, TypeScript, Tailwind CSS, Phosphor Icons, Framer Motion |
| i18n | `next-intl` v4 — locales `ua`, `ru`, `en` |
| Auth | Discord OAuth2 (HTTP-only session cookie). Owner-only admin gating via `OWNER_DISCORD_ID` env var. |
| CMS storage | JSON files in `.cms-overrides/` (text overrides, image overrides, layout, dynamic pages, navbar/footer) |
| Video editor | ffmpeg, called from `src/app/api/editor/sessions/[id]/render/route.ts`. Sessions stored in `.editor-sessions/<id>/`. |
| Bot | Python 3.11, discord.py 2.7, aiohttp, ffmpeg |

## 3. Production environment

| Item | Value |
|------|-------|
| Server IP | `45.12.62.204` |
| Hostname | `cornflower-iron.mhost.ee` (provider: mhost.ee) |
| OS | Debian 12 bookworm, 1 CPU, 2 GB RAM, 24 GB disk |
| Domain | `yhil.duckdns.org` (free DuckDNS subdomain) |
| SSL | Let's Encrypt (auto-renew via certbot.timer) |
| Site service | `systemd: yhilyanty-site.service` → `npm run start -p 3000` (proxied behind nginx) |
| Bot service | `systemd: yhilbot.service` → Python venv at `/opt/yhilbot/.venv/bin/python bot.py` |
| Site path | `/opt/yhilyanty-site/` |
| Bot path | `/opt/yhilbot/` |
| nginx config | `/etc/nginx/sites-available/yhilyanty` + `/etc/nginx/conf.d/ratelimit.conf` |
| fail2ban jails | `sshd`, `nginx-auth-abuse`, `nginx-limit-req`, `nginx-bad-bots` (configs in `/etc/fail2ban/jail.d/custom.conf`) |
| CrowdSec | iptables firewall bouncer using community IP-reputation feed |
| Auto-updates | `unattended-upgrades` for security patches |
| ufw | only ports 22, 80, 443 open |

## 4. Credentials & where they live

**Server access**:
- SSH key (preferred): `/home/ubuntu/yhil-server-key` on the build host (this Devin VM). Public key in `/root/.ssh/authorized_keys` on the server.
- Root password (fallback): rotated regularly. Last known stored only in user's password manager — NOT committed anywhere.

**Discord OAuth (login)**:
- Application: https://discord.com/developers/applications/1497897295264612372
- `DISCORD_CLIENT_ID = 1497897295264612372`
- `DISCORD_CLIENT_SECRET` — set on server in `/opt/yhilyanty-site/.env.production` (chmod 600)
- Redirect URI registered: `https://yhil.duckdns.org/api/auth/callback`

**Discord bot**:
- Same application as OAuth (1497897295264612372)
- `DISCORD_TOKEN` — set on server in `/opt/yhilbot/yhil.env` (chmod 600)
- `OWNER_ID = 546710148144562176`

**Bot ↔ site auth**:
- Shared secret `YHILBOT_API_TOKEN` (32-byte hex prefixed `yhil_`). Generated during initial server build by `openssl rand -hex 32`.
- On site: `/opt/yhilyanty-site/.env.production` → `YHILBOT_API_TOKEN=yhil_...`
- On bot: `/opt/yhilbot/yhil.env` → `WEB_EDITOR_TOKEN=yhil_...` (must match)

**DuckDNS**:
- Domain: `yhil.duckdns.org` → `45.12.62.204`
- Token: stored only in user's account at https://www.duckdns.org/

**Cloudflare**:
- User has a CF account with the zone `yhil.duckdns.org` added — but it sits as `pending` because DuckDNS doesn't allow changing NS servers, so CF proxy is **not active**. Server-side hardening (fail2ban + CrowdSec + nginx rate limits) compensates. To enable CF proxy, register a real domain (~$1-10/year on Namecheap/Porkbun) and add it to the same CF account.

## 5. Current deployment status (as of 2026-04-30)

| Item | Status |
|------|--------|
| Site (Next.js) | ✅ live at https://yhil.duckdns.org/ua |
| HTTPS / Let's Encrypt | ✅ deployed, auto-renewed |
| Security hardening | ✅ fail2ban, CrowdSec, ufw, unattended-upgrades, security headers |
| Discord OAuth login | ✅ ready (user must add redirect URI in dev portal) |
| Admin CMS (texts, images, layout, pages, nav) | ✅ deployed, accessible by owner only |
| Video editor (sessions, render) | ✅ deployed |
| Bot (discord.py) | ⏸ deployed to `/opt/yhilbot/` and configured but **service NOT started** until user explicitly tells us to. The user's exact instruction was "ботом вообще не заходи на дискорд сервера без моей команды". |
| Old bot (Client ID `1499028032952733886`) | ⏳ user to delete in Developer Portal |
| Cloudflare DDoS proxy | ❌ not active (DuckDNS ↔ CF NS-delegation incompatibility) |

## 6. Turning the bot on

When the user says "запускай бота" (or similar):

```bash
ssh -i /home/ubuntu/yhil-server-key root@45.12.62.204 \
  'systemctl enable --now yhilbot.service && journalctl -u yhilbot.service -n 30 --no-pager'
```

Look for `🟢 Готов: <name>#xxxx | GPU=нет | GUILD_IDS=global` in the logs. If you see auth errors → token in `yhil.env` is stale, regenerate via Developer Portal → Bot → Reset Token.

## 7. Common operations

**Update site after a new commit** (zero-downtime-ish — single restart):

```bash
ssh -i /home/ubuntu/yhil-server-key root@45.12.62.204 'bash -s' <<'EOF'
cd /opt/yhilyanty-site
git pull
npm ci
npm run build
systemctl restart yhilyanty-site
EOF
```

**Update bot after a new commit**:

```bash
ssh -i /home/ubuntu/yhil-server-key root@45.12.62.204 'bash -s' <<'EOF'
cd /opt/yhilbot
git pull
.venv/bin/pip install -r requirements.txt
systemctl restart yhilbot
EOF
```

> **NB**: the server currently has `/opt/yhilyanty-site` and `/opt/yhilbot` as plain directories (created from tarballs during initial deploy). To enable `git pull` workflow, run on the server once:
> ```bash
> cd /opt/yhilyanty-site && git init && git remote add origin https://github.com/c8rnell8/yhilyanty-site.git && git fetch && git reset --hard origin/main
> cd /opt/yhilbot && git init && git remote add origin https://github.com/c8rnell8/yhilbot.git && git fetch && git reset --hard origin/main
> ```
> (Skip if you'd rather rebuild + scp tarballs each time.)

**Inspect logs**:

```bash
ssh -i /home/ubuntu/yhil-server-key root@45.12.62.204 'journalctl -u yhilyanty-site -n 50 --no-pager'
ssh -i /home/ubuntu/yhil-server-key root@45.12.62.204 'journalctl -u yhilbot -n 50 --no-pager'
ssh -i /home/ubuntu/yhil-server-key root@45.12.62.204 'tail -n 100 /var/log/nginx/access.log'
```

**Check banned IPs**:

```bash
ssh -i /home/ubuntu/yhil-server-key root@45.12.62.204 'fail2ban-client status sshd; fail2ban-client status nginx-auth-abuse; cscli decisions list'
```

**Whitelist your own IP** (if you get accidentally banned, like Devin did during initial deploy):

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

**Rotate the YHILBOT_API_TOKEN**: edit it on both sides (`/opt/yhilyanty-site/.env.production` and `/opt/yhilbot/yhil.env`) and restart both services. Both files have `chmod 600`.

## 8. Repository layout

```
yhilyanty-site/
├── README.md            ← user-facing intro
├── HANDOFF.md           ← this file
├── MIGRATION.md         ← how to move to a different VPS
├── .env.example         ← env vars template
├── deploy/              ← nginx, systemd, fail2ban configs
├── public/              ← static assets (logos, photos)
└── src/
    ├── app/
    │   ├── [locale]/
    │   │   ├── page.tsx           ← landing
    │   │   ├── join/, roster/, merch/, bot/    ← top-level pages
    │   │   ├── admin/             ← CMS (owner-only, server-gated)
    │   │   │   ├── content/       ← edit translations
    │   │   │   ├── images/        ← edit image slots
    │   │   │   ├── layout-editor/ ← reorder landing sections
    │   │   │   ├── pages/         ← create dynamic /p/<slug> pages
    │   │   │   └── nav/           ← edit navbar + footer
    │   │   ├── editor/[id]/       ← video editor UI
    │   │   └── p/[slug]/          ← rendered dynamic pages
    │   └── api/
    │       ├── auth/              ← Discord OAuth (login, callback, logout, me)
    │       ├── admin/             ← CMS write endpoints (owner-only)
    │       ├── cms/images/[file]/ ← CMS-uploaded image serving
    │       ├── editor/sessions/   ← video editor sessions API
    │       └── merch/order/       ← merch order submission
    ├── components/
    ├── i18n/                      ← next-intl config
    ├── messages/                  ← ua.json, ru.json, en.json
    ├── lib/                       ← cms helpers, auth, editor session model
    └── middleware.ts              ← next-intl + auth middleware
```

The `.cms-overrides/` directory at the project root is **NOT in git** (gitignored). It's the persistent CMS data for the running deployment. Back it up periodically — see MIGRATION.md.

## 9. Things that aren't done

- [ ] Cloudflare proxy (requires real domain to bypass DuckDNS NS-delegation issue)
- [ ] CSRF tokens on admin POST forms (rate-limits + same-site cookies + owner gating provide reasonable defense, but CSRF would be belt-and-suspenders)
- [ ] hCaptcha/Turnstile on `/api/merch/order` (currently just rate-limited)
- [ ] Backups of `.cms-overrides/` — should be on a cron job to S3 or similar
- [ ] CI/CD pipeline (currently deploys are manual: scp tarball or git pull)
- [ ] Monitoring/uptime alerts

## 10. How a different AI agent should pick this up

1. Read this file end-to-end.
2. `git clone` both repos, examine `deploy/DEPLOY.md` and `MIGRATION.md` for fuller infra detail.
3. Ask the user for the current root password if the SSH key in this Devin VM is gone.
4. Verify the site is up: `curl -I https://yhil.duckdns.org/` should return 200.
5. Verify the bot status: `ssh root@... 'systemctl status yhilbot'`. If it's running and the user is happy, leave it alone.
6. Pick up open items from "Things that aren't done" or whatever the user requests.
7. **Before any destructive operation** (especially anything touching SSH config, fail2ban, or the firewall): whitelist your own IP first to avoid lockout. There is a footgun here — see the section above on how Devin previously locked itself out.

## 11. Key files for quick orientation

- <ref_file file="/home/ubuntu/yhilyanty-site/README.md" /> — user-facing readme
- <ref_file file="/home/ubuntu/yhilyanty-site/MIGRATION.md" /> — VPS migration runbook
- <ref_file file="/home/ubuntu/yhilyanty-site/deploy/DEPLOY.md" /> — fresh-server install steps
- <ref_file file="/home/ubuntu/yhilyanty-site/deploy/nginx.conf" /> — nginx template
- <ref_file file="/home/ubuntu/yhilyanty-site/deploy/yhilyanty-site.service" /> — systemd unit
- <ref_file file="/home/ubuntu/yhilyanty-site/.env.example" /> — required env vars
