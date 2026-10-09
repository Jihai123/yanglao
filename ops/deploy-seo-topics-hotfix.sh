#!/usr/bin/env bash
# Scoped homepage topic-card hotfix, pinned to GitHub CI-verified merge commit.
# Does not touch the database, PHP config, Nginx, or any other site.
set -Eeuo pipefail
umask 022

APP=/www/wwwroot/yanglao
HOST=yanglao.zhibeimao.com
BASE=3e1bc7d7f944fac4b480bca1b49bd08451ea168f
TARGET=595ce832bb0fae23dc3a0bbfc87aad5b1db50d83
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP="/var/backups/yanglao/$STAMP-seo-topics"
TMP=$(mktemp -d /tmp/yanglao-seo-topics.XXXXXX)
CHANGED=0

FILES=$(cat <<'FILE_LIST'
assets/conversion-v2.css
index.html
tests_e2e/test_v2_acquisition_p1.py
FILE_LIST
)

log(){ printf '[seo-topics-hotfix] %s\n' "$*"; }
fail(){ log "BLOCKED: $*"; exit 1; }

rollback(){
  set +e
  log "Hotfix verification failed; rolling back to $BASE"
  umask 022
  git -C "$APP" reset --hard "$BASE" >/dev/null
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    if [ -f "$BACKUP/old/$f" ]; then cp -a "$BACKUP/old/$f" "$APP/$f"; fi
  done <<< "$FILES"
  local ok=1
  [ "$(git -C "$APP" rev-parse HEAD)" = "$BASE" ] || ok=0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    if ! cmp -s "$APP/$f" "$BACKUP/old/$f" ||
       [ "$(stat -c '%a' "$APP/$f" 2>/dev/null)" != "$(stat -c '%a' "$BACKUP/old/$f" 2>/dev/null)" ]; then
      log "ROLLBACK_MISMATCH $f"
      ok=0
    fi
  done <<< "$FILES"
  if [ "$ok" = 1 ]; then log "ROLLBACK_CONTENT_AND_MODES_PASS"; else log "ROLLBACK_INCOMPLETE — inspect immediately"; fi
  local code
  code=$(curl -ksS --noproxy '*' --resolve "$HOST:443:127.0.0.1" \
       --connect-timeout 5 --max-time 15 -o /dev/null -w '%{http_code}' "https://$HOST/" || true)
  log "ROLLBACK_ORIGIN_HTTP=$code"
}
cleanup(){
  local ec=$?
  trap - EXIT
  if [ "$ec" -ne 0 ] && [ "$CHANGED" = 1 ]; then rollback; fi
  rm -rf -- "$TMP"
  exit "$ec"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

[ "$(id -u)" -eq 0 ] || fail "Run as root"
[ -d "$APP/.git" ] || fail "Production is not a Git checkout"
for cmd in git curl cmp stat flock mkdir cp; do command -v "$cmd" >/dev/null || fail "Missing $cmd"; done
exec 9>/tmp/yanglao-acquisition-rollout.lock
flock -n 9 || fail "Another deployment is running"

[ "$(git -C "$APP" rev-parse HEAD)" = "$BASE" ] || fail "Production HEAD not expected baseline"
[ -z "$(git -C "$APP" status --porcelain --untracked-files=no)" ] || fail "Production has tracked edits"
while IFS= read -r f; do
  [ -n "$f" ] || continue
  [ -f "$APP/$f" ] && [ ! -L "$APP/$f" ] || fail "Missing or linked original file $f"
  [ "$(stat -c '%a' "$APP/$f")" = 644 ] || fail "Expected 644 mode on original $f"
done <<< "$FILES"

old_code=$(curl -ksS --noproxy '*' --resolve "$HOST:443:127.0.0.1" \
  --connect-timeout 5 --max-time 15 -o /dev/null -w '%{http_code}' "https://$HOST/" || true)
[ "$old_code" = 200 ] || fail "Original homepage HTTP $old_code, refusing hotfix"

log "Fetching pinned, reviewed fix"
git -C "$APP" fetch --quiet --no-tags origin "$TARGET"
git -C "$APP" merge-base --is-ancestor "$BASE" "$TARGET" || fail "Target is not a descendant of deployed commit"
printf '%s\n' "$FILES" > "$TMP/expected"
git -C "$APP" diff --name-only "$BASE" "$TARGET" > "$TMP/actual"
diff -u "$TMP/expected" "$TMP/actual" || fail "Commit changes more than the three audited files"

mkdir -p -m 700 "$BACKUP/old"
while IFS= read -r f; do
  [ -n "$f" ] || continue
  mkdir -p "$BACKUP/old/$(dirname "$f")"
  cp -a "$APP/$f" "$BACKUP/old/$f"
done <<< "$FILES"
printf 'base=%s\ntarget=%s\n' "$BASE" "$TARGET" > "$BACKUP/manifest.txt"

log "Deploying the 3-file CSS/HTML/test-only fix"
CHANGED=1
umask 022
git -C "$APP" merge --ff-only "$TARGET" >/dev/null
[ "$(git -C "$APP" rev-parse HEAD)" = "$TARGET" ] || fail "Git target mismatch"
while IFS= read -r f; do
  [ -n "$f" ] || continue
  [ "$(stat -c '%a' "$APP/$f")" = 644 ] || fail "Bad installed permissions for $f"
done <<< "$FILES"

probe(){
  local path="$1" marker="$2" output="$TMP/res.html" code
  code=$(curl -ksS --noproxy '*' --resolve "$HOST:443:127.0.0.1" \
    --connect-timeout 5 --max-time 20 -o "$output" -w '%{http_code}' "https://$HOST$path" || true)
  [ "$code" = 200 ] || fail "Origin $path returned $code"
  grep -Fq "$marker" "$output" || fail "Origin $path did not contain hotfix marker"
  log "ORIGIN_HTTP_200 $path"
}
probe '/?verify=seo-topics' 'class="seo-topic-link"'
probe '/assets/conversion-v2.css?v=20261009-seo-topics' '.seo-topic-link'
probe '/?verify=seo-topics' 'conversion-v2.css?v=20261009-seo-topics'

public_code=$(curl -sS -L --connect-timeout 10 --max-time 30 \
  -o "$TMP/public.html" -w '%{http_code}' "https://$HOST/?verify=seo-topics-$STAMP" || true)
[ "$public_code" = 200 ] || fail "Public Cloudflare homepage returned $public_code"
grep -Fq 'class="seo-topic-link"' "$TMP/public.html" || fail "Public homepage not yet updated"
log "PUBLIC_CDN_HTTP_200_PASS"

log "HOTFIX_DEPLOY_PASS: $TARGET"
log "Backup retained: $BACKUP"
log "No DB/schema, PHP/Nginx, or other website changes."
