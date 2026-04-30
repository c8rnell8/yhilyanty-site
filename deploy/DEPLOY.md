# Deploy notes (Debian 12)

## Prereqs

```bash
apt-get install -y nodejs npm nginx certbot python3-certbot-nginx fail2ban ufw ffmpeg
```

Node must be ≥ 22 (use NodeSource repo).

## First deploy

```bash
# Server side
mkdir -p /opt/yhilyanty-site
cd /opt/yhilyanty-site
git clone https://github.com/c8rnell8/yhilyanty-site.git .
npm ci
npm run build

# Create .env.production (not in git)
cat > .env.production <<EOFENV
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
OWNER_DISCORD_ID=...
SITE_URL=https://yourdomain
YHILBOT_API_TOKEN=...
NODE_ENV=production
EOFENV
chmod 600 .env.production

# Install systemd unit
cp deploy/yhilyanty-site.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now yhilyanty-site

# Install nginx config
cp deploy/ratelimit.conf /etc/nginx/conf.d/
sed "s|__DOMAIN__|yourdomain.tld|g" deploy/nginx.conf > /etc/nginx/sites-available/yhilyanty
ln -s /etc/nginx/sites-available/yhilyanty /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# SSL
certbot --nginx -d yourdomain.tld --non-interactive --agree-tos -m you@mail

# Firewall + fail2ban
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
cp deploy/fail2ban-nginx-auth.conf /etc/fail2ban/jail.d/
cp deploy/fail2ban-nginx-filter.conf /etc/fail2ban/filter.d/nginx-auth-limit.conf
systemctl reload fail2ban
```

## Update (zero-downtime-ish)

```bash
cd /opt/yhilyanty-site
git pull
npm ci
npm run build
systemctl restart yhilyanty-site
```
