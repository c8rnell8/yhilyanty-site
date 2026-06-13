#!/usr/bin/env python3
"""yhil-sentinel — lightweight security agent.

Tails the nginx access log, flags anomalies that the plain nginx rate-limit
misses (parameter fuzzing, 4xx storms, auth hammering, scanner fingerprints)
and bans the offending IP through CrowdSec → fail2ban → iptables (whichever is
available). Optionally asks Gemini (free tier) for a short daily threat summary.

Designed for a 1-CPU VPS: pure stdlib, a rolling in-memory window, no DB.

Run continuously under systemd (see sentinel.service) or one-shot from cron.

Env:
  SENTINEL_ACCESS_LOG   default /var/log/nginx/access.log
  SENTINEL_WHITELIST    comma-separated IPs/CIDRs never to ban (add your own IP!)
  SENTINEL_BAN_SECONDS  default 14400 (4h)
  SENTINEL_DRY_RUN      "1" = log decisions but don't ban
  GEMINI_API_KEY        optional, enables the daily AI summary
"""

from __future__ import annotations

import ipaddress
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from collections import defaultdict, deque

ACCESS_LOG = os.environ.get("SENTINEL_ACCESS_LOG", "/var/log/nginx/access.log")
BAN_SECONDS = int(os.environ.get("SENTINEL_BAN_SECONDS", "14400"))
DRY_RUN = os.environ.get("SENTINEL_DRY_RUN") == "1"
WHITELIST = [w.strip() for w in os.environ.get("SENTINEL_WHITELIST", "").split(",") if w.strip()]

WINDOW = 60          # seconds of history we reason over
REQ_LIMIT = 240      # >this many reqs/min from one IP = flood
ERR_LIMIT = 40       # >this many 4xx/min = scanning/fuzzing
AUTH_LIMIT = 12      # >this many hits on /api/auth /min = credential hammering
FUZZ_LIMIT = 25      # >this many distinct query strings on one path = param fuzzing

# nginx "combined" log: IP - - [time] "METHOD /path?q HTTP/1.1" status size "ref" "ua"
LINE = re.compile(
    r'^(?P<ip>\S+) \S+ \S+ \[[^\]]+\] "(?P<method>\S+) (?P<path>[^ "]*?)(?:\?(?P<qs>[^ "]*))? [^"]*" '
    r'(?P<status>\d{3}) \S+ "[^"]*" "(?P<ua>[^"]*)"'
)
SCANNER_UA = re.compile(r"(sqlmap|nikto|nmap|masscan|nuclei|wpscan|fuzz|dirbuster|gobuster|hydra|zgrab)", re.I)

_banned: dict[str, float] = {}


def log(msg: str) -> None:
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)


def whitelisted(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True  # unparsable → don't touch
    for w in WHITELIST:
        try:
            if "/" in w:
                if addr in ipaddress.ip_network(w, strict=False):
                    return True
            elif ip == w:
                return True
        except ValueError:
            continue
    return False


def ban(ip: str, reason: str) -> None:
    now = time.time()
    if ip in _banned and now - _banned[ip] < BAN_SECONDS:
        return  # already banned recently
    _banned[ip] = now
    log(f"BAN {ip} — {reason}{' (dry-run)' if DRY_RUN else ''}")
    if DRY_RUN:
        return
    # Prefer CrowdSec, then fail2ban, then raw iptables.
    if shutil.which("cscli"):
        subprocess.run(
            ["cscli", "decisions", "add", "--ip", ip, "--duration", f"{BAN_SECONDS}s",
             "--reason", f"yhil-sentinel: {reason}"],
            check=False,
        )
    elif shutil.which("fail2ban-client"):
        subprocess.run(["fail2ban-client", "set", "nginx-bad-bots", "banip", ip], check=False)
    elif shutil.which("iptables"):
        subprocess.run(["iptables", "-I", "INPUT", "-s", ip, "-j", "DROP"], check=False)
    else:
        log("no ban backend available (cscli/fail2ban/iptables)")


def analyze(events: deque) -> None:
    """events: deque of (ts, ip, path, status, qs, ua) within the window."""
    reqs: dict[str, int] = defaultdict(int)
    errs: dict[str, int] = defaultdict(int)
    auth: dict[str, int] = defaultdict(int)
    fuzz: dict[tuple[str, str], set] = defaultdict(set)

    for _ts, ip, path, status, qs, ua in events:
        if whitelisted(ip):
            continue
        reqs[ip] += 1
        if 400 <= status < 500:
            errs[ip] += 1
        if path.startswith("/api/auth"):
            auth[ip] += 1
        if qs:
            fuzz[(ip, path)].add(qs)
        if SCANNER_UA.search(ua):
            ban(ip, f"scanner UA: {ua[:40]}")

    for ip, n in reqs.items():
        if n > REQ_LIMIT:
            ban(ip, f"flood {n} req/{WINDOW}s")
    for ip, n in errs.items():
        if n > ERR_LIMIT:
            ban(ip, f"{n} 4xx/{WINDOW}s (scanning)")
    for ip, n in auth.items():
        if n > AUTH_LIMIT:
            ban(ip, f"{n} auth hits/{WINDOW}s (credential hammering)")
    for (ip, path), variants in fuzz.items():
        if len(variants) > FUZZ_LIMIT:
            ban(ip, f"param fuzzing on {path}: {len(variants)} variants")


def gemini_summary(events: deque) -> None:
    key = os.environ.get("GEMINI_API_KEY")
    if not key or not events:
        return
    sample = "\n".join(
        f"{ip} {status} {path}?{qs} {ua[:30]}" for _ts, ip, path, status, qs, ua in list(events)[-80:]
    )
    body = json.dumps({
        "contents": [{"role": "user", "parts": [{"text":
            "You are a security analyst. From these nginx log lines, list in <=5 short "
            "bullet points any suspicious patterns or attacks and the IPs involved. "
            "If nothing suspicious, say 'no anomalies'.\n\n" + sample}]}],
    }).encode()
    req = urllib.request.Request(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent",
        data=body, headers={"Content-Type": "application/json", "x-goog-api-key": key},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.load(r)
        text = "".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"])
        log("AI summary:\n" + text.strip())
    except Exception as e:  # noqa: BLE001
        log(f"AI summary skipped: {e}")


def follow(path: str):
    """Yield new lines appended to the log, surviving rotation."""
    while not os.path.exists(path):
        time.sleep(2)
    f = open(path, "r", errors="ignore")
    f.seek(0, os.SEEK_END)
    inode = os.fstat(f.fileno()).st_ino
    while True:
        line = f.readline()
        if line:
            yield line
            continue
        time.sleep(0.5)
        try:  # detect logrotate
            if os.stat(path).st_ino != inode:
                f.close()
                f = open(path, "r", errors="ignore")
                inode = os.fstat(f.fileno()).st_ino
        except FileNotFoundError:
            pass


def main() -> None:
    log(f"yhil-sentinel watching {ACCESS_LOG} (dry_run={DRY_RUN}, whitelist={WHITELIST})")
    events: deque = deque()
    last_analyze = 0.0
    last_summary = 0.0
    for line in follow(ACCESS_LOG):
        m = LINE.match(line)
        if not m:
            continue
        now = time.time()
        events.append((now, m["ip"], m["path"], int(m["status"]), m["qs"] or "", m["ua"] or ""))
        while events and now - events[0][0] > WINDOW:
            events.popleft()
        if now - last_analyze >= 5:
            last_analyze = now
            analyze(events)
        if now - last_summary >= 86400:  # once a day
            last_summary = now
            gemini_summary(events)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
