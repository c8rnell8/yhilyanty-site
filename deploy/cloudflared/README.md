# Cloudflare Tunnel — hide the VPS behind Cloudflare

Goal: every request reaches the site through Cloudflare's network, so the
server's real IP is invisible to direct scanning and you can **close 80/443**
entirely. Free Cloudflare plan covers this. Needs a real domain on a
Cloudflare account (DuckDNS won't work — see HANDOFF.md note).

## 1. Install cloudflared

```bash
# Debian/Ubuntu
curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared
```

## 2. Authenticate + create the tunnel

```bash
cloudflared tunnel login                 # opens a browser link, pick your domain
cloudflared tunnel create yhil           # prints a <TUNNEL_ID> and writes creds JSON
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/<TUNNEL_ID>.json /etc/cloudflared/
```

Put `config.yml` (in this folder) at `/etc/cloudflared/config.yml`, filling in
`<TUNNEL_ID>` and your real hostname.

## 3. Route DNS + run as a service

```bash
cloudflared tunnel route dns yhil yhil.example.com   # creates the proxied CNAME
sudo cloudflared service install
sudo systemctl enable --now cloudflared
systemctl status cloudflared
```

## 4. Close the public ports (the whole point)

Once the tunnel serves the site, slam the door on direct access:

```bash
sudo ufw delete allow 80/tcp
sudo ufw delete allow 443/tcp
sudo ufw allow 2222/tcp        # keep SSH (your non-standard port)
sudo ufw status verbose
```

cloudflared makes only **outbound** connections to Cloudflare, so nothing
inbound needs to be open except SSH. Direct hits to the VPS IP on 80/443 now
get nothing — scanners can't even find the app.

## 5. Bonus hardening on Cloudflare's side (free)

- Turn on "Under Attack Mode" during a DDoS.
- WAF managed rules + a rate-limiting rule on `/api/*`.
- Block countries you don't serve; challenge bad ASNs.
- This layers on top of the server-side nginx WAF / fail2ban / sentinel.
