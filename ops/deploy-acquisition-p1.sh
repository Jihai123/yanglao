#!/usr/bin/env bash
# yanglao acquisition P1 production rollout, pinned to validated commit.
# Updates application files only. No schema migration, service restart, or unrelated file deletion.
set -Eeuo pipefail
umask 077

APP=/www/wwwroot/yanglao
BASE=3ef65ebfc3e69f2e9c367ff779cddb44e810352f
TARGET=3e1bc7d7f944fac4b480bca1b49bd08451ea168f
SITE=https://yanglao.zhibeimao.com
BACKUP_PARENT=/var/backups/yanglao
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TMP=$(mktemp -d /tmp/yanglao-acq-rollout.XXXXXX)
BACKUP="$BACKUP_PARENT/$STAMP-p1"
CHANGED=0
GIT_MODE=0

FILES=$(cat <<'FILES_EOF'
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
FILES_EOF
)

log(){ printf '[yanglao-deploy] %s\n' "$*"; }
die(){ log "BLOCKED: $*"; exit 1; }
rollback(){
  log "Post-update check failed; restoring previous production files."
  set +e
  if [ "$GIT_MODE" = 1 ]; then
    git -C "$APP" reset --hard "$BASE" >/dev/null
  else
    while IFS= read -r file; do
      [ -n "$file" ] || continue
      if [ -f "$BACKUP/old/$file" ]; then
        cp -a "$BACKUP/old/$file" "$APP/$file"
      else
        rm -f -- "$APP/$file"
      fi
    done <<< "$FILES"
  fi
  log "Rollback attempted. Backup retained at $BACKUP"
}
finish(){
  ec=$?
  trap - EXIT
  if [ "$ec" -ne 0 ] && [ "$CHANGED" = 1 ]; then rollback; fi
  rm -rf -- "$TMP"
  exit "$ec"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

[ "$(id -u)" -eq 0 ] || die "Run as root: sudo bash <script>"
[ -d "$APP" ] && [ -f "$APP/index.html" ] && [ -f "$APP/api/event.php" ] || die "Unexpected production layout: $APP"
for tool in curl tar cmp sha256sum git php flock mktemp; do command -v "$tool" >/dev/null || die "Missing dependency $tool"; done
exec 9>/tmp/yanglao-acquisition-rollout.lock
flock -n 9 || die "Another deployment is running"
[ "$(df -Pk "$APP" | awk 'NR==2 {print $4}')" -gt 102400 ] || die "Less than 100 MB free space"

mkdir -p "$TMP/old" "$TMP/new"
log "Downloading immutable GitHub snapshots: baseline $BASE, target $TARGET"
curl -fL --retry 2 --connect-timeout 10 --max-time 120 -sS "https://codeload.github.com/Jihai123/yanglao/tar.gz/$BASE" -o "$TMP/old.tgz"
curl -fL --retry 2 --connect-timeout 10 --max-time 120 -sS "https://codeload.github.com/Jihai123/yanglao/tar.gz/$TARGET" -o "$TMP/new.tgz"
tar -xzf "$TMP/old.tgz" -C "$TMP/old" --strip-components=1
tar -xzf "$TMP/new.tgz" -C "$TMP/new" --strip-components=1

log "Checking previous version and file drift (abort rather than overwrite changes)"
while IFS= read -r file; do
  [ -n "$file" ] || continue
  [ -f "$TMP/new/$file" ] || die "Target package missing $file"
  if [ -f "$TMP/old/$file" ]; then
    [ -f "$APP/$file" ] && [ ! -L "$APP/$file" ] || die "Previous production file missing/symlink: $file"
    cmp -s "$APP/$file" "$TMP/old/$file" || die "Production drift on $file (not overwriting)"
  else
    [ ! -e "$APP/$file" ] && [ ! -L "$APP/$file" ] || die "New-path collision on $file"
  fi
done <<< "$FILES"

for file in api/admin.php api/event.php api/acquisition-query.php; do
  php -l "$TMP/new/$file" >/dev/null || die "PHP syntax failed: $file"
done
grep -Fq 'landing-entry.js?v=20261008-p1' "$TMP/new/index.html" || die "Missing homepage bridge"
grep -Fq '/guides/minimum-pension-years.html' "$TMP/new/sitemap.xml" || die "Missing sitemap landing"

if [ -d "$APP/.git" ] || [ -f "$APP/.git" ]; then
  GIT_MODE=1
  [ "$(git -C "$APP" rev-parse HEAD)" = "$BASE" ] || die "Production Git HEAD is not expected baseline"
  [ -z "$(git -C "$APP" status --porcelain --untracked-files=no)" ] || die "Production has tracked local edits; refusing Git merge"
  git -C "$APP" fetch --quiet --no-tags origin "$TARGET"
  git -C "$APP" merge-base --is-ancestor "$BASE" "$TARGET" || die "Target not descendant of baseline"
fi

mkdir -p -m 700 "$BACKUP/old"
while IFS= read -r file; do
  [ -n "$file" ] || continue
  if [ -f "$APP/$file" ]; then
    mkdir -p "$BACKUP/old/$(dirname "$file")"
    cp -a "$APP/$file" "$BACKUP/old/$file"
  fi
done <<< "$FILES"
printf 'old=%s\nnew=%s\nmethod=%s\n' "$BASE" "$TARGET" "$GIT_MODE" >"$BACKUP/manifest.txt"

log "Deploying audited code (backup: $BACKUP)"
CHANGED=1
if [ "$GIT_MODE" = 1 ]; then
  git -C "$APP" merge --ff-only "$TARGET" >/dev/null
else
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    dest="$APP/$file"
    mkdir -p "$(dirname "$dest")"
    temp_file=$(mktemp "$(dirname "$dest")/.yanglao-new.XXXXXX")
    cp -- "$TMP/new/$file" "$temp_file"
    if [ -f "$dest" ]; then
      chmod --reference="$dest" "$temp_file"
      chown --reference="$dest" "$temp_file"
    else
      chmod 0644 "$temp_file"
      chown --reference="$APP" "$temp_file"
    fi
    mv -f -- "$temp_file" "$dest"
  done <<< "$FILES"
fi

while IFS= read -r file; do
  [ -n "$file" ] || continue
  cmp -s "$APP/$file" "$TMP/new/$file" || die "Installed file differs: $file"
done <<< "$FILES"
if [ "$GIT_MODE" = 1 ]; then
  [ "$(git -C "$APP" rev-parse HEAD)" = "$TARGET" ] || die "Git HEAD mismatch after fast-forward"
fi
for file in api/admin.php api/event.php api/acquisition-query.php; do
  php -l "$APP/$file" >/dev/null || die "Installed PHP lint failed: $file"
done

# Query-string cache busting verifies public web delivery; no policy or data input is sent.
probe="deploy=$STAMP"
http_get(){
  path="$1"
  needle="$2"
  output="$TMP/http-$(printf '%s' "$path" | sha256sum | cut -c 1-12)"
  case "$path" in *\?*) url="$SITE$path&$probe";; *) url="$SITE$path?$probe";; esac
  status=$(curl -sS -fL --connect-timeout 10 --max-time 35 --retry 1 \
    -o "$output" -w '%{http_code}' "$url") || die "HTTP GET failed: $path"
  [ "$status" = 200 ] || die "HTTP $status for $path"
  grep -Fq "$needle" "$output" || die "HTTP content mismatch: $path"
  log "HTTP 200 verified: $path"
}

http_get '/' 'landing-entry.js?v=20261008-p1'
http_get '/guides/flexible-employment-pension.html' 'data-landing-cta="flexible-employment-pension"'
http_get '/guides/minimum-pension-years.html' 'data-landing-cta="minimum-pension-years"'
http_get '/tools/retirement-age.html' 'data-landing-cta="retirement-age"'
http_get '/sitemap.xml' '/tools/retirement-age.html'
http_get '/js/landing-growth.js' 'landing_cta_click'
http_get '/admin/index.html' 'landingAcquisition'

# One deliberately marked anonymous probe exercises the real PHP -> MySQL INSERT path.
# It uses a test app_version, so cannot count in the three landing funnels.
probe_id="deployment-smoke-$STAMP-$$"
code=$(curl -sS --connect-timeout 10 --max-time 30 -o "$TMP/event.json" -w '%{http_code}' \
  -H 'Content-Type: application/json' -X POST "$SITE/api/event.php" \
  --data "{\"event\":\"landing_cta_click\",\"feature\":\"early\",\"step\":\"flexible-employment-pension\",\"visitor_id\":\"$probe_id\",\"session_id\":\"$probe_id\",\"flow_id\":\"$probe_id\",\"source\":\"direct\",\"device\":\"desktop\",\"page\":\"/__deployment_smoke__\",\"app_version\":\"deployment-smoke-20261009\"}") || die "Event API request failed"
[ "$code" = 201 ] && grep -Fq '"ok":true' "$TMP/event.json" || die "Event API did not return 201/ok"
log "Anonymous event INSERT smoke PASS (isolated test app_version)"

log "DEPLOY_PASS: verified $TARGET"
log "Backup retained: $BACKUP"
log "No database migration, no PHP/Nginx restart, no change to unrelated websites."
