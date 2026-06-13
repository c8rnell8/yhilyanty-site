# Безопасность — чеклист и как устроена защита

Простыми словами: что уже сделано в коде, и что нужно один раз настроить на сервере, когда поднимешь новый VPS. Идём сверху вниз.

## Что уже встроено в сайт (ничего делать не нужно)

- **Вход только через Discord.** На сайте нет паролей — красть нечего. Кука сессии подписана криптоподписью (HMAC), подделать чужой вход нельзя, сессия живёт максимум 7 дней.
- **Должности.** Доступ к админке только у владельца и тех, кому он выдал роль (`admin`/`editor`). Выдаёт роли только владелец.
- **CSRF / межсайтовые атаки.** Все изменяющие запросы отвергают чужой Origin.
- **Защита от спама** (rate-limit) на входе, заказах, AI, переводе и рендере видео — даже без nginx.
- **Заголовки безопасности**: HSTS, X-Frame-Options (нет кликджекинга), nosniff, Referrer-Policy, Permissions-Policy.
- **Загрузки**: проверка типа по байтам файла (не по имени), лимиты размера, защита от выхода за папку (path traversal).
- **Журнал действий**: кто и когда что менял (`/admin/system`).
- **Бэкап**: одной кнопкой выгрузить/восстановить весь сайт.
- **База данных**: её нет. Весь контент — JSON-файлы в `.cms-overrides/`, поэтому SQL-инъекции физически некуда применить. (Пункт «сменить префикс таблиц / отдельный пользователь БД» из общих гайдов тут не нужен — он про WordPress/MySQL.)

## WAF и фильтрация (nginx)

Файлы в `deploy/`:
- `waf.conf` → положить в `/etc/nginx/conf.d/waf.conf`. Блокирует known-сканеры (sqlmap, nikto, nuclei…) и явные атаки (SQLi/XSS/traversal-паттерны, попытки залезть в `/.env`, `/.git`, `/wp-admin`).
- `nginx.conf` → `if ($bad_bot)`/`if ($bad_request)` возвращают 403; разрешены только нужные HTTP-методы; закрыты dotfiles и `.bak/.sql/.env/.log`; ограничение одновременных соединений с одного IP.
- `ratelimit.conf` → зоны лимитов запросов и соединений.

После правок: `nginx -t && systemctl reload nginx`.

## Файрвол (ufw) — только нужные порты

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 80/tcp          # HTTP (редирект на HTTPS)
ufw allow 443/tcp         # HTTPS
ufw allow 2222/tcp        # SSH на НЕстандартном порту (см. ниже)
ufw enable
ufw status verbose
```

SSH на нестандартном порту: в `/etc/ssh/sshd_config` поставь `Port 2222`, `PermitRootLogin prohibit-password`, `PasswordAuthentication no` (только ключи). `systemctl restart sshd`. **Сначала** открой 2222 в ufw, потом меняй порт — иначе закроешь себе доступ.

## SSL (шифрование трафика)

Уже есть: Let's Encrypt + `certbot.timer` обновляет автоматически. Проверка: `certbot certificates`. Конфиг TLS в `nginx.conf` (только TLS 1.2/1.3).

## fail2ban + CrowdSec (баны за перебор)

Джейлы уже описаны в `deploy/fail2ban-*.conf` (sshd, nginx-auth-abuse, nginx-limit-req, nginx-bad-bots). CrowdSec iptables-bouncer добавляет репутационные баны поверх. Проверка:

```bash
fail2ban-client status
cscli decisions list
```

Если случайно забанил себя — рецепт разбана в `HANDOFF.md`.

## Логи — централизованный сбор и анализ

```bash
# Ротация уже включена logrotate. Быстрый анализ доступа/ошибок:
tail -f /var/log/nginx/access.log /var/log/nginx/error.log
# Топ IP по числу запросов за сегодня:
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head
# Журнал сервисов:
journalctl -u yhilyanty-site -n 100 --no-pager
journalctl -u yhilbot -n 100 --no-pager
```

При желании — переслать логи в бесплатный внешний сборщик (например, Grafana Loki self-hosted или betterstack free tier).

## Аудит безопасности — сканеры

Запускать периодически (раз в месяц/после крупных изменений):

```bash
# Аудит самого сервера (настройки, права, ядро):
apt install lynis -y && lynis audit system

# Скан сайта снаружи на типовые дыры и забытые файлы:
apt install nikto -y && nikto -h https://ВАШ_ДОМЕН

# Проверка свежести пакетов безопасности:
unattended-upgrades --dry-run -d
```

`Wordfence`/`Imunify360` из общих гайдов — это плагины для WordPress, здесь не применимы; их роль закрывают nginx-WAF + fail2ban + CrowdSec + Lynis.

## Обновления

`unattended-upgrades` ставит security-патчи сам. Раз в пару недель: `apt update && apt upgrade`.

## Эшелонированная оборона — готовые конфиги (deploy/)

Всё ниже — production-ready файлы в репозитории, бесплатные.

- **CI/CD безопасности** — `.github/workflows/security.yml` (сайт: `npm audit` high/critical + Gitleaks + опц. SonarCloud) и такой же в репо бота (`pip-audit` + compile + Gitleaks). Запускается на каждый push/PR. SonarCloud включается добавлением секрета `SONAR_TOKEN`.
- **Docker-изоляция** — `deploy/docker/`: образы сайта и бота от **non-root** пользователя, `read_only` ФС (запись только в тома `.cms-overrides` и логи), `no-new-privileges`, `cap_drop: ALL`, лимиты CPU/RAM. Запуск: `docker compose -f deploy/docker/docker-compose.yml up -d --build`.
- **Cloudflare Tunnel** — `deploy/cloudflared/`: прячет реальный IP VPS, после настройки закрываешь 80/443 в ufw, наружу только SSH. Пошагово в `deploy/cloudflared/README.md`.
- **Целостность хоста (AIDE)** — `deploy/secops/aide-setup.sh` (база) + `aide-check.sh` (ежедневный cron, алерт в Discord-webhook при изменении системных бинарников/конфигов nginx/кода).
- **ИИ-агент безопасности** — `deploy/secops/sentinel.py` + `sentinel.service`: читает логи nginx, ловит то, что пропускает обычный rate-limit (перебор параметров, шторм 4xx, долбёжка авторизации, сигнатуры сканеров) и банит IP через CrowdSec → fail2ban → iptables. Стартует в `DRY_RUN=1` (только логирует) — посмотри сутки и переключи на enforcement. Опционально раз в день шлёт AI-сводку угроз через бесплатный Gemini. **Впиши свой IP в `SENTINEL_WHITELIST`, чтобы не забанить себя.**

## Если появятся деньги (опционально, не обязательно)

Единственная вещь, которую нельзя закрыть бесплатно на 1-CPU сервере, — **мощный DDoS**. Лекарство — проксирование через Cloudflare, но оно требует своего домена (DuckDNS не даёт менять NS). Купив домен (~$10/год) и направив его на Cloudflare, получишь промышленную защиту от DDoS и WAF бесплатно поверх их сети.
