#!/usr/bin/env bash
# Read-only investigation after the 2026-10-09 acquisition P1 rollout rollback.
# Writes temporary diagnostics under /tmp, never modifies the website or its DB.
set -uo pipefail
umask 077

APP=/www/wwwroot/yanglao
BASE=3ef65ebfc3e69f2e9c367ff779cddb44e810352f
HOST=yanglao.zhibeimao.com
TMP=$(mktemp -d /tmp/yanglao-acq-diag.XXXXXX) || exit 2
trap 'rm -rf -- "$TMP"' EXIT

say(){ printf '%s\n' "$*"; }
say "===== 1. Production directory, modes, Git state ====="
for d in "$APP" "$APP/guides" "$APP/tools" "$APP/api" "$APP/js"; do
  if [ -e "$d" ]; then
    stat -c 'DIR_MODE %a %U:%G %n' "$d"
  else
    say "DIR_MISSING $d"
  fi
done
if [ -d "$APP/.git" ] || [ -f "$APP/.git" ]; then
  say "GIT_HEAD $(git -C "$APP" rev-parse HEAD 2>/dev/null || echo unavailable)"
  if [ -z "$(git -C "$APP" status --porcelain --untracked-files=no 2>/dev/null)" ]; then
    say 'GIT_TRACKED_STATUS clean'
  else
    say 'GIT_TRACKED_STATUS dirty (file names suppressed)'
  fi
else
  say 'GIT_HEAD not_a_git_checkout'
fi

say "===== 2. Reconcile rollback against immutable baseline ====="
if curl -fsSL --retry 1 --connect-timeout 10 --max-time 120 \
 "https://codeload.github.com/Jihai123/yanglao/tar.gz/$BASE" \
 -o "$TMP/baseline.tgz" && mkdir -p "$TMP/baseline" && \
 tar -xzf "$TMP/baseline.tgz" -C "$TMP/baseline" --strip-components=1; then
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    if [ -f "$TMP/baseline/$f" ]; then
      if [ ! -f "$APP/$f" ]; then
        say "ROLLBACK_MISMATCH missing_original $f"
      elif cmp -s "$APP/$f" "$TMP/baseline/$f"; then
        say "ROLLBACK_BASE_MATCH $f"
      else
        say "ROLLBACK_MISMATCH modified_original $f"
      fi
    elif [ -e "$APP/$f" ]; then
      say "ROLLBACK_MISMATCH leftover_new $f"
    else
      say "ROLLBACK_NEW_REMOVED $f"
    fi
  done <<'FILES'
admin/index.html
api/acquisition-query.php
api/admin.php
api/event.php
assets/growth-landings.css
guides/flexible-employment-pension.html
guides/minimum-pension-years.html
index.html
js/landing-entry.js
js/landing-growth.js
sitemap.xml
tools/retirement-age.html
FILES
else
  say 'ROLLBACK_BASELINE_UNAVAILABLE (GitHub codeload unreachable; no modification made)'
fi

say "===== 3. Public and local-origin HTTP GET probes (no cookies, no writes) ====="
probe() {
  local label="$1" url="$2" header="$TMP/h" body="$TMP/b" code
  shift 2
  : > "$header"; : > "$body"
  code=$(curl --silent --show-error --location --connect-timeout 7 --max-time 18 \
         --output "$body" --dump-header "$header" --write-out '%{http_code}' \
         "$@" "$url" 2>"$TMP/error") || code=000
  say "PROBE $label http=$code"
  awk '/^(HTTP\/|[Ss]erver:|[Ll]ocation:|[Vv]ia:|[Xx]-[Cc]ache:|[Cc][Ff]-[Rr]ay:|[Xx]-[Tt]engine-[Ee]rror:|[Xx]-[Ss]ucuri-[Ii]d:)/ {
      sub(/\r$/, ""); print "  " substr($0,1,220)
    }' "$header" | tail -12
  if [ "$code" = 000 ]; then
    sed -n '1p' "$TMP/error" | cut -c 1-180 | sed 's/^/  CURL_ERROR /'
  fi
}
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/134.0.0.0 Safari/537.36'
probe public_home "https://$HOST/"
probe public_home_query "https://$HOST/?deploy=20261009T033023Z"
probe public_home_browser_UA "https://$HOST/" --user-agent "$UA"
probe public_index_html "https://$HOST/index.html"
probe public_robots "https://$HOST/robots.txt"
probe localhost_HTTP "http://127.0.0.1/" --noproxy '*' --header "Host: $HOST"
probe localhost_HTTPS "https://$HOST/" --noproxy '*' --resolve "$HOST:443:127.0.0.1"

say "===== 4. End of READ_ONLY_DIAG: no production changes ====="
