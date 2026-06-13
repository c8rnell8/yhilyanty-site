#!/usr/bin/env bash
# Host file-integrity monitoring with AIDE on Ubuntu/Debian.
# Run once as root to install + initialise the baseline.
set -euo pipefail

apt-get update
apt-get install -y aide aide-common

# Watch the things an attacker would tamper with: system binaries, the nginx
# config, the site/bot code and systemd units. (Editing /etc/aide here keeps
# the noise low on a small VPS; tune to taste.)
cat >/etc/aide/aide.conf.d/99_yhil <<'EOF'
/usr/bin       VarFile
/usr/sbin      VarFile
/bin           VarFile
/sbin          VarFile
/etc/nginx     VarFile
/opt/yhilyanty-site/src   VarFile
/opt/yhilbot/yhilbot      VarFile
/etc/systemd/system       VarFile
EOF

echo "Building AIDE baseline (this can take a few minutes)…"
aideinit -y -f
mv -f /var/lib/aide/aide.db.new /var/lib/aide/aide.db 2>/dev/null || true
echo "AIDE baseline ready at /var/lib/aide/aide.db"
echo "Re-run 'aide --update' and promote the db after any LEGITIMATE change."
