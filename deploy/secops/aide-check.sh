#!/usr/bin/env bash
# Daily AIDE integrity check. Silent when clean; alerts on any change to the
# watched binaries/configs. Install as a cron job:
#
#   cp deploy/secops/aide-check.sh /usr/local/sbin/aide-check.sh
#   chmod 700 /usr/local/sbin/aide-check.sh
#   # /etc/cron.d/aide-check  → run 03:17 daily
#   echo '17 3 * * * root /usr/local/sbin/aide-check.sh' >/etc/cron.d/aide-check
#
# Set DISCORD_WEBHOOK to get a ping in a private channel; otherwise it logs to
# the journal and root's mail.
set -uo pipefail

DISCORD_WEBHOOK="${DISCORD_WEBHOOK:-}"
REPORT="$(aide --check 2>&1 || true)"

if echo "$REPORT" | grep -qiE 'found differences|changed|added|removed'; then
  SUMMARY="$(echo "$REPORT" | grep -iE 'changed|added|removed|differences' | head -20)"
  MSG="⚠️ AIDE: file-integrity changes on $(hostname) at $(date -Is)
$SUMMARY"
  logger -t aide-check "INTEGRITY ALERT: $SUMMARY"
  if [ -n "$DISCORD_WEBHOOK" ]; then
    # jq-free JSON: escape the message safely with python.
    python3 - "$DISCORD_WEBHOOK" "$MSG" <<'PY'
import json, sys, urllib.request
hook, msg = sys.argv[1], sys.argv[2][:1800]
data = json.dumps({"content": msg}).encode()
try:
    urllib.request.urlopen(urllib.request.Request(hook, data=data,
        headers={"Content-Type": "application/json"}), timeout=15)
except Exception as e:
    print("webhook failed:", e)
PY
  fi
else
  logger -t aide-check "integrity OK"
fi
