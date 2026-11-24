#!/usr/bin/env bash
# Record status, selected headers and body for a fixed URL set against the BUILT web-solid server.
# Use it to prove a refactor changed no output: snapshot before, snapshot after, then
#   diff -r .snapshots/before .snapshots/after        (empty output means identical)
#
# Usage, from web-solid/ after `pnpm run build`:
#   scripts/build-snapshot-corpus.sh .snapshots/corpus-before   # once per code state, about a minute
#   CORPUS=.snapshots/corpus-before/corpus scripts/route-snapshot.sh .snapshots/before
# Env:  CORPUS  a published corpus dir (HUKUM_CORPUS_DIR). Default .snapshots/corpus/corpus.
#       PORT    server port. Default 3199.
#
# Normalised, because these bytes differ run to run or build to build:
#   content-hashed /assets/<chunk>.js|css paths and the asset-id map (chunk names follow the file layout);
#   <link rel="modulepreload"> tags (one per lazy route chunk, so they shift with the route files);
#   the _hk hydration ids and the keys of the hydration payload (_$HY.r["<id>"]), which count reactive
#   owners and so shift when an expression is written another way (server and client derive them from the
#   same compiled code, so they cannot disagree). The payload values (the served records) are kept.
# Stylesheet <link> tags, class attributes and everything else are kept.
set -euo pipefail
corpus="$(realpath "${CORPUS:-.snapshots/corpus/corpus}")"
out="$(realpath -m "${1:?usage: route-snapshot.sh <outdir>}")"
port="${PORT:-3199}"
release="$(tr -d '\n' < "$corpus/active-release")"
rm -rf "$out"
mkdir -p "$out"
log="$(mktemp)"

HUKUM_CORPUS_DIR="$corpus" PORT="$port" node dist/server/node.js > "$log" 2>&1 &
server=$!
trap 'kill $server 2>/dev/null || true; rm -f "$log"' EXIT
for _ in $(seq 1 50); do
  curl -s -o /dev/null "http://localhost:$port/" && break
  sleep 0.2
done

ite=/koleksi/ite
draft=/ruu/perampasan-aset
urls=(
  /
  /tentang/
  /tidak-ada/
  /uu
  /uu/
  /uu/tahun/2008/
  /uu/tahun/1800/
  /uu/tahun/abc/
  /uu/11/2008
  /uu/11/2008/
  '/uu/11/2008/?bandingkan'
  '/uu/11/2008/?bandingkan='
  '/uu/11/2008/?bandingkan=uu_19_2016'
  '/uu/11/2008/?bandingkan=uu_1_2024'
  '/uu/11/2008/?bandingkan=uu_0_0000'
  '/uu/11/2008/?bandingkan&dari=uu_19_2016'
  '/uu/11/2008/?dari=uu_19_2016'
  /uu/11/2008/perubahan/
  /uu/19/2016/
  '/uu/19/2016/?bandingkan'
  /uu/19/2016/perubahan/
  /uu/9/1960/
  '/uu/9/1960/?bandingkan'
  /uu/9/1960/perubahan/
  /uu/9999/2008/
  /uu/abc/2008/
  /uu/11/20080/
  /koleksi/
  "$ite/"
  "$ite/2016-11-25/"
  "$ite/9999-01-01/"
  "$ite/latest/"
  "$ite/perubahan.json"
  /koleksi/tidak-ada/
  /koleksi/tidak-ada/perubahan.json
  /koleksi/Bad_Slug/
  /ruu/
  "$draft/"
  "$draft/ruu_perampasan-aset_2023-05_draft_pemerintah/"
  "$draft/ruu_perampasan-aset_2026-11-19_draft-final/"
  "$draft/ruu_tidak-ada/"
  /ruu/tidak-ada/
  /ruu/tidak-ada/ruu_x/
  /cari/
  '/cari/?q='
  '/cari/?q=ite'
  '/cari/?q=pasal+27+ite'
  '/cari/?q=uu+11/2008'
  '/cari/?q=zzzzqqq'
  '/cari/?q=%3Cscript%3E'
  /cari/laws.json
  "/search-index/$release/pagefind-entry.json"
  "/search-index/$release/pagefind.js"
  "/search-index/$release/nope.json"
  /search-index/BAD/pagefind.js
  "/search-index/$release/../../x.json"
)

i=0
for url in "${urls[@]}"; do
  i=$((i + 1))
  name="$(printf '%03d' "$i")$(printf '%s' "$url" | tr -c 'A-Za-z0-9._=-' '_' | cut -c1-60)"
  curl -s --path-as-is -D "$out/.h" -o "$out/.b" "http://localhost:$port$url" || true
  {
    echo "GET $url"
    head -1 "$out/.h" | tr -d '\r'
    grep -iE '^(content-type|cache-control|location|allow):' "$out/.h" | tr -d '\r' | tr 'A-Z' 'a-z' | sort || true
    echo
    sed -E \
      -e 's#<link rel="modulepreload"[^>]*>##g' \
      -e 's/_\$HY\.r\["[0-9]+(_[a-z]+)?"\]/_$HY.r["ID"]/g' \
      -e 's/ _hk=[0-9A-Za-z]+/ _hk=ID/g' \
      -e 's#\{"[0-9A-F]+":"/assets/[^}]*\}#{ASSET-MAP}#g' \
      -e 's#/assets/[A-Za-z0-9_.$-]+\.(js|css)#/assets/ASSET.\1#g' "$out/.b"
  } > "$out/$name.txt"
done

for spec in "POST /search-index/$release/pagefind.js" "HEAD /search-index/$release/pagefind.js" "POST /cari/laws.json"; do
  i=$((i + 1))
  method="${spec%% *}"
  path="${spec#* }"
  name="$(printf '%03d' "$i")$method$(printf '%s' "$path" | tr -c 'A-Za-z0-9._=-' '_' | cut -c1-60)"
  if [ "$method" = HEAD ]; then flag=(-I); else flag=(-X "$method"); fi
  curl -s "${flag[@]}" -D "$out/.h" -o "$out/.b" "http://localhost:$port$path" || true
  {
    echo "$method $path"
    head -1 "$out/.h" | tr -d '\r'
    grep -iE '^(content-type|cache-control|allow):' "$out/.h" | tr -d '\r' | tr 'A-Z' 'a-z' | sort || true
  } > "$out/$name.txt"
done
rm -f "$out/.h" "$out/.b"
echo "snapshot: $(ls "$out" | wc -l) responses in $out"
