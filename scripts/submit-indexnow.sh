#!/usr/bin/env bash
set -euo pipefail

HOST="yanglao.zhibeimao.com"
KEY="e191443aad6ec586a62dbc2c4fd1273e"
KEY_URL="https://${HOST}/${KEY}.txt"
INDEXNOW_ENDPOINT="https://api.indexnow.org/indexnow"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

collect_urls() {
  if (( $# > 0 )); then
    printf '%s\n' "$@"
    return
  fi

  if [[ ! -f "${ROOT}/sitemap.xml" ]]; then
    echo "sitemap.xml not found: ${ROOT}/sitemap.xml" >&2
    exit 2
  fi

  grep -oE '<loc>[^<]+</loc>' "${ROOT}/sitemap.xml" \
    | sed -E 's#</?loc>##g'
}

mapfile -t URLS < <(collect_urls "$@")

if (( ${#URLS[@]} == 0 )); then
  echo "No URLs to submit." >&2
  exit 2
fi

for url in "${URLS[@]}"; do
  if [[ "${url}" != "https://${HOST}/"* && "${url}" != "https://${HOST}/" ]]; then
    echo "Refusing URL outside ${HOST}: ${url}" >&2
    exit 2
  fi

done

key_status="$(curl -fsS -o /dev/null -w '%{http_code}' "${KEY_URL}" || true)"
if [[ "${key_status}" != "200" ]]; then
  echo "IndexNow key is not publicly reachable (${KEY_URL}, HTTP ${key_status})." >&2
  exit 3
fi

failed=0
for url in "${URLS[@]}"; do
  status="$(curl -sS -o /tmp/yanglao-indexnow-response.txt -w '%{http_code}' \
    --get "${INDEXNOW_ENDPOINT}" \
    --data-urlencode "url=${url}" \
    --data-urlencode "key=${KEY}" \
    --data-urlencode "keyLocation=${KEY_URL}" || true)"

  case "${status}" in
    200|202)
      echo "IndexNow accepted (${status}): ${url}"
      ;;
    *)
      echo "IndexNow failed (${status}): ${url}" >&2
      if [[ -s /tmp/yanglao-indexnow-response.txt ]]; then
        cat /tmp/yanglao-indexnow-response.txt >&2
        echo >&2
      fi
      failed=1
      ;;
  esac
done

rm -f /tmp/yanglao-indexnow-response.txt
exit "${failed}"
