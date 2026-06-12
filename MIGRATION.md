# Migrating to a different VPS

For when the current host (`45.12.62.204` / mhost.ee) needs replacing. About half an hour if you have shell access to both the old and new boxes.

## What you'll need

1. SSH access to the **old** server (`45.12.62.204`).
2. A **new** Linux VPS (Debian 12 / Ubuntu 22+ recommended, ≥ 1 GB RAM, ≥ 10 GB disk).
3. SSH key/password for the new server.
4. Ability to update DNS for `yhil.duckdns.org` (or a different domain) to the new IP.
5. The DuckDNS token (or whichever DNS provider you're moving to).

## Step 0 — Snapshot of moving parts

| What's on the box | Type | Action |
|-------------------|------|--------|
| `/opt/yhilyanty-site` (Next.js) | code | re-clone from git |
| `/opt/yhilyanty-site/.cms-overrides/` | data | **must copy** (texts/images/layout/pages/nav) |
| `/opt/yhilyanty-site/.editor-sessions/` | transient | OK to skip |
| `/opt/yhilyanty-site/.merch-orders/` | data | **must copy** (merch orders) |
| `/opt/yhilyanty-site/.env.production` | secrets | **must copy** |
| `/opt/yhilbot` (Python) | code | re-clone from git |
| `/opt/yhilbot/yhil.env` | secrets | **must copy** |
| `/etc/letsencrypt/` | TLS | **must copy** OR re-issue with certbot |
| `/etc/nginx/sites-available/yhilyanty` | config | re-deploy from `deploy/nginx.conf` |
| `/etc/nginx/conf.d/ratelimit.conf` | config | re-deploy from `deploy/ratelimit.conf` |
| `/etc/systemd/system/yhilyanty-site.service` | unit | re-deploy from `deploy/yhilyanty-site.service` |
| `/etc/systemd/system/yhilbot.service` | unit | install (template at end of this doc) |
| fail2ban / CrowdSec / ufw rules | hardening | re-install (idempotent) |

## Step 1 — Snapshot data on old server

On the **old** server:

```bash
ssh root@45.12.62.204
mkdir -p /root/migration
cd /root/migration

tar czf cms-overrides.tar.gz -C /opt/yhilyanty-site .cms-overrides
tar czf merch-orders.tar.gz -C /opt/yhilyanty-site .merch-orders 2>/dev/null || true

# Secrets
cp /opt/yhilyanty-site/.env.production .
cp /opt/yhilbot/yhil.env .

# TLS — reuse certs to avoid LE rate limit
tar czf letsencrypt.tar.gz -C /etc letsencrypt

ls -la /root/migration
```

## Step 2 — Copy snapshot to new server

From your laptop:

```bash
NEW=<new-server-ip>
scp -r root@45.12.62.204:/root/migration .
scp -r migration root@$NEW:/root/
```

Or directly server-to-server (faster, doesn't go through your laptop):

```bash
ssh root@45.12.62.204 'cd /root && rsync -az --progress migration/ root@<new-ip>:/root/migration/'
```

## Step 3 — Bootstrap new server

On the **new** server:

```bash
# System packages
apt-get update
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs nginx certbot python3-certbot-nginx fail2ban ufw ffmpeg \
    python3.11 python3-venv python3-pip git unattended-upgrades

# Firewall (open ports BEFORE enabling, so you don't lock yourself out)
ufw allow OpenSSH
ufw allow 'Nginx Full'
echo y | ufw enable

# CrowdSec (optional but recommended; pull this LAST)
curl -s https://install.crowdsec.net | bash
apt-get install -y crowdsec crowdsec-firewall-bouncer-iptables
```

## Step 4 — Restore site

On the **new** server:

```bash
mkdir -p /opt/yhilyanty-site
git clone https://github.com/c8rnell8/yhilyanty-site.git /opt/yhilyanty-site
cd /opt/yhilyanty-site
# OR if cloning fails (private repo without token), scp the tarball over
npm ci --no-audit --no-fund

# Restore data
tar xzf /root/migration/cms-overrides.tar.gz -C /opt/yhilyanty-site
tar xzf /root/migration/merch-orders.tar.gz -C /opt/yhilyanty-site 2>/dev/null || true
cp /root/migration/.env.production /opt/yhilyanty-site/.env.production
chmod 600 /opt/yhilyanty-site/.env.production

# Build
npm run build

# systemd unit
cp /opt/yhilyanty-site/deploy/yhilyanty-site.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable yhilyanty-site  # don't start yet — nginx not configured
```

## Step 5 — Restore bot

```bash
mkdir -p /opt/yhilbot
git clone https://github.com/c8rnell8/yhilbot.git /opt/yhilbot
cd /opt/yhilbot

python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

cp /root/migration/yhil.env /opt/yhilbot/yhil.env
chmod 600 /opt/yhilbot/yhil.env

# systemd unit (see template at end)
cat > /etc/systemd/system/yhilbot.service <<'UNIT'
[Unit]
Description=YHIL Discord Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/yhilbot
EnvironmentFile=/opt/yhilbot/yhil.env
ExecStart=/opt/yhilbot/.venv/bin/python bot.py
Restart=always
RestartSec=10
PrivateTmp=yes
NoNewPrivileges=yes
ProtectHome=read-only
ProtectSystem=full
ReadWritePaths=/opt/yhilbot /tmp/yhil_work

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable yhilbot  # don't start yet
```

## Step 6 — DNS cutover

Point `yhil.duckdns.org` → new IP. **Do this BEFORE configuring nginx with the existing certs**, otherwise certbot won't be able to renew.

```bash
# DuckDNS update via API
NEW_IP=<new-ip>
DUCKDNS_TOKEN=<token>  # from https://www.duckdns.org/
curl "https://www.duckdns.org/update?domains=yhil&token=${DUCKDNS_TOKEN}&ip=${NEW_IP}"
# expect: "OK"
```

Wait ≈ 60s for propagation, verify:

```bash
dig +short yhil.duckdns.org   # should return new IP
```

## Step 7 — Restore TLS and nginx

```bash
# Restore Let's Encrypt
tar xzf /root/migration/letsencrypt.tar.gz -C /etc

# Restore nginx config
cp /opt/yhilyanty-site/deploy/ratelimit.conf /etc/nginx/conf.d/
sed 's|__DOMAIN__|yhil.duckdns.org|g' /opt/yhilyanty-site/deploy/nginx.conf \
  > /etc/nginx/sites-available/yhilyanty
ln -sf /etc/nginx/sites-available/yhilyanty /etc/nginx/sites-enabled/yhilyanty
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Verify cert auto-renewal
certbot renew --dry-run
```

If the restored certs are within 30 days of expiry, run `certbot renew` to refresh. If they're broken, just re-issue:

```bash
certbot --nginx -d yhil.duckdns.org --non-interactive --agree-tos -m you@you.com
```

## Step 8 — Start services

```bash
systemctl start yhilyanty-site
sleep 5
curl -sS -o /dev/null -w "site: %{http_code}\n" https://yhil.duckdns.org/ua
# Expect: site: 200

# Bot — only if user authorized you to start it
# systemctl start yhilbot
# journalctl -u yhilbot -n 30 --no-pager
```

## Step 9 — Restore hardening

```bash
# fail2ban
cp /opt/yhilyanty-site/deploy/fail2ban-nginx-auth.conf /etc/fail2ban/jail.d/nginx-auth-abuse.conf
cp /opt/yhilyanty-site/deploy/fail2ban-nginx-filter.conf /etc/fail2ban/filter.d/nginx-auth-limit.conf
# … or copy directly from old /etc/fail2ban/jail.d/custom.conf
scp root@45.12.62.204:/etc/fail2ban/jail.d/custom.conf /etc/fail2ban/jail.d/

# IMPORTANT: whitelist your own IP BEFORE enabling, or you'll lock yourself out
MY_IP=$(curl -sS https://api.ipify.org)
sed -i "s|^ignoreip.*|ignoreip = 127.0.0.1/8 ::1 $MY_IP|" /etc/fail2ban/jail.d/custom.conf
# (or add the line if not present)

systemctl restart fail2ban
fail2ban-client status

# CrowdSec
cscli collections install crowdsecurity/nginx crowdsecurity/linux
cat > /etc/crowdsec/acquis.d/nginx.yaml <<'CS'
filenames:
 - /var/log/nginx/access.log
 - /var/log/nginx/error.log
labels:
  type: nginx
CS
mkdir -p /etc/crowdsec/parsers/s02-enrich
cat > /etc/crowdsec/parsers/s02-enrich/whitelist-self.yaml <<WL
name: crowdsecurity/whitelist-self
description: Whitelist trusted clients
whitelist:
  reason: trusted operator
  ip:
    - $MY_IP
WL
systemctl restart crowdsec
```

## Step 10 — Verify

From a third-party (use https://check-host.net or similar):

- `https://yhil.duckdns.org/ua` → 200
- `https://yhil.duckdns.org/api/auth/me` → 200 with JSON (probably `{ "user": null }`)
- HTTP → HTTPS redirect works
- Discord login flow works (test in incognito)
- `/admin/*` redirects unauthorized users
- Bot responds to `/help` in Discord (only after starting `yhilbot.service`)

## Step 11 — Decommission old server

After 24-48 hours of stable operation on the new server:

```bash
ssh root@45.12.62.204
systemctl stop yhilyanty-site yhilbot
# … or simply terminate the VPS via mhost.ee panel
```

---

## Optional: switch DNS provider during migration

If you want to also move from DuckDNS to a real domain:

1. Buy a domain (e.g. `yhil.xyz` from Namecheap or Porkbun, often $1/year).
2. Add the domain to Cloudflare (free plan).
3. CF will give you 2 nameservers — set them at the registrar.
4. In CF DNS, add `A yhil.xyz → <new-ip>` (proxied, orange cloud).
5. Wait for activation (5-30 min).
6. Run `certbot --nginx -d yhil.xyz` for a fresh cert.
7. Update `SITE_URL=https://yhil.xyz` in `/opt/yhilyanty-site/.env.production`.
8. Update `WEB_EDITOR_URL=https://yhil.xyz` in `/opt/yhilbot/yhil.env`.
9. Add the new redirect URI `https://yhil.xyz/api/auth/callback` in the Discord Developer Portal.
10. Restart both services.

This finally turns on Cloudflare's DDoS proxy + WAF, which DuckDNS couldn't provide.

## Troubleshooting

**Site returns 502** → Next.js process not listening. Check `systemctl status yhilyanty-site` and `journalctl -u yhilyanty-site -n 50`.

**Site returns 504** → Next.js process is up but slow / blocked. Check Node OOM (1 GB RAM is tight; consider 2 GB).

**Discord login redirects to error page** → redirect URI in Discord Developer Portal doesn't match `SITE_URL` in `.env.production`. Update one or the other.

**Cert renewal fails** → DNS not pointing here, or port 80 blocked. Check `dig` and `ufw status`.

**Bot can't reach site** → `WEB_EDITOR_URL` mismatch with reality, or `WEB_EDITOR_TOKEN` mismatch with `YHILBOT_API_TOKEN` on the site. Both must be identical.

**Locked out by fail2ban** → if you can SSH in via a different IP (or VNC console at the host's panel), run `fail2ban-client unban --all` and add your IP to the `ignoreip` list.
