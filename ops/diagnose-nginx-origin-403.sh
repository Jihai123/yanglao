#!/usr/bin/env bash
# Read-only Nginx 403 investigation for yanglao.zhibeimao.com.
# Temporary probe files are created only under /tmp. No DB, site writes, reload, restart or config changes.
set -u
umask 077
HOST=yanglao.zhibeimao.com
ROOT=/www/wwwroot/yanglao
TMP=$(mktemp -d /tmp/yanglao-origin-diag.XXXXXX) || exit 2
trap 'rm -rf -- "$TMP"' EXIT

printf '===== A: file path permissions =====\n'
for file in "$ROOT" "$ROOT/index.html" "$ROOT/robots.txt" "$ROOT/api" "$ROOT/sitemap.xml"; do
  if [ -e "$file" ]; then stat -c '%a %U:%G %n' "$file"; else printf 'MISSING %s\n' "$file"; fi
done
if command -v namei >/dev/null; then namei -l "$ROOT/index.html" | tail -n 7; fi

printf '===== B: local Nginx HTTP behavior =====\n'
probe() {
  local name="$1" url="$2" status
  shift 2
  status=$(curl -k --noproxy '*' -sS -L --max-time 15 --connect-timeout 5 \
    -o "$TMP/body" -D "$TMP/headers" -w '%{http_code}' "$@" "$url" 2>"$TMP/curl-error") || status=000
  printf 'PROBE %s HTTP=%s\n' "$name" "$status"
  grep -iE '^(HTTP/|server:|location:|content-type:|content-length:)' "$TMP/headers" 2>/dev/null | tail -n 6 | tr -d '\r' || true
  if [ "$status" = 000 ]; then head -n 1 "$TMP/curl-error" | cut -c 1-160; fi
  if [ "$status" = 403 ]; then
    printf '  FORBIDDEN_BODY_SHA256='
    sha256sum "$TMP/body" | cut -d ' ' -f 1
    printf '  FORBIDDEN_BODY_PREFIX='
    head -c 180 "$TMP/body" | tr '\n' ' ' | tr -cd '\11\12\15\40-\176'
    printf '\n'
  fi
}
probe http_home http://127.0.0.1/ -H "Host: $HOST"
probe http_index http://127.0.0.1/index.html -H "Host: $HOST"
probe http_robots http://127.0.0.1/robots.txt -H "Host: $HOST"
probe https_home "https://$HOST/" --resolve "$HOST:443:127.0.0.1"
probe https_index "https://$HOST/index.html" --resolve "$HOST:443:127.0.0.1"
probe https_robots "https://$HOST/robots.txt" --resolve "$HOST:443:127.0.0.1"

printf '===== C: active web process, vhost config safe directives =====\n'
if command -v ss >/dev/null; then ss -lntp 2>/dev/null | grep -E '(:80 |:443 )' | head -n 12 || true; fi
if command -v nginx >/dev/null; then nginx -t 2>&1 | tail -n 4; fi

for conf in \
 "/www/server/panel/vhost/nginx/$HOST.conf" \
 "/etc/nginx/sites-enabled/$HOST" \
 "/etc/nginx/conf.d/$HOST.conf"; do
  if [ -r "$conf" ]; then
    printf 'VHOST_CONFIG=%s\n' "$conf"
    awk '
      /^[[:space:]]*(server_name|listen|root|index|access_log|error_log|location|include|deny|allow|return|auth_basic|try_files|error_page)[[:space:]]/ {
        line=$0
        sub(/[[:space:]]*#.*/, "", line)
        if (line ~ /auth_basic[[:space:]]/ && line !~ /auth_basic[[:space:]]+off[[:space:]]*;/) line="  auth_basic [enabled; value suppressed];"
        if (length(line)>220) line=substr(line,1,220)
        print NR ":" line
      }' "$conf" | head -n 100
  fi
done

printf '===== D: recent relevant Nginx errors (IP and request redacted) =====\n'
for logfile in \
 "/www/wwwlogs/$HOST.error.log" \
 "/www/wwwlogs/$HOST.log" \
 "/www/server/nginx/logs/error.log" \
 "/var/log/nginx/error.log"; do
  if [ -r "$logfile" ] && [ -s "$logfile" ]; then
    printf 'LOG_FILE=%s\n' "$logfile"
    tail -n 400 "$logfile" |
      grep -iE 'permission denied|forbidden|access denied|directory index|limiting requests|blocked|denied by rule|open\(\)|403|rewrite or internal redirection|no such file' |
      tail -n 16 |
      sed -E 's/client: [^, ]+/client: [REDACTED]/g; s/request: "[^"]*"/request: "[REDACTED]"/g; s/host: "[^"]*"/host: "[REDACTED]"/g' |
      cut -c 1-260 || true
  fi
done
printf '===== READ_ONLY_ORIGIN_DIAG_COMPLETE =====\n'
