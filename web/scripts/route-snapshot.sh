#!/usr/bin/env bash
# Record status, selected headers and body for a fixed URL set against the BUILT web server.
# Use it to prove a refactor changed no output: snapshot before, snapshot after, then
#   diff -r .snapshots/before .snapshots/after        (empty output means identical)
#
# Usage, from web/ after `pnpm run build`:
#   CORPUS=.snapshots/corpus-before scripts/route-snapshot.sh .snapshots/before
# Env:  CORPUS  a corpus dir (HUKUM_CORPUS_DIR). Default .snapshots/corpus.
#               When it holds no release yet, the script has the pipeline export the full corpus from the
#               repo data and publish it there (`uv run hukum-rapih export-corpus --publish ... --public ../web/public`, about two
#               minutes, from ../pipeline) and prints the release id.
#               The release id hashes every released file, so two builds with the same id are byte-identical.
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
corpus="$(realpath -m "${CORPUS:-.snapshots/corpus}")"
out="$(realpath -m "${1:?usage: route-snapshot.sh <outdir>}")"
port="${PORT:-3199}"
if [ ! -f "$corpus/active-release" ]; then
  (cd ../pipeline && uv run hukum-rapih export-corpus --publish "$corpus" --public ../web/public) >&2
fi
release="$(tr -d '\n' < "$corpus/active-release")"
echo "corpus release: $release"
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
older=ruu_perampasan-aset_2023-05_draft_pemerintah
newer=ruu_perampasan-aset_2026-11-19_draft-final
urls=(
  /
  /tentang/
  /tentang
  /favicon.ico
  /tidak-ada/
  /uu
  /uu/
  /uu/tahun/2008/
  /uu/tahun/1800/
  /uu/tahun/abc/
  /uu/tahun/2026/
  /uu/tahun/1960/
  /uu/tahun/02008/
  /uu/11/2008
  /uu/11/2008/
  '/uu/11/2008/?v'
  '/uu/11/2008/?v='
  '/uu/11/2008/?v=uu_19_2016'
  '/uu/11/2008/?v=uu_1_2024'
  '/uu/11/2008/?v=uu_0_0000'
  '/uu/11/2008/?v=uu_11_2008,uu_1_2024'
  '/uu/11/2008/?v=uu_1_2024,uu_11_2008'
  '/uu/11/2008/?v=uu_19_2016,uu_19_2016'
  '/uu/11/2008/?v=uu_11_2008,uu_19_2016,uu_1_2024'
  '/uu/11/2008/?v=uu_11_2008,uu_1_2024,uu_0_0000'
  '/uu/11/2008/?v=uu_11_2008&v=uu_1_2024'
  '/uu/11/2008/?bandingkan=uu_1_2024&dari=uu_11_2008'
  /uu/11/2008/perubahan/
  /uu/19/2016/
  '/uu/19/2016/?v='
  /uu/19/2016/perubahan/
  /uu/9/1960/
  '/uu/9/1960/?v='
  /uu/9/1960/perubahan/
  /uu/15/1950/
  /uu/15/1950/perubahan/
  /uu/11/2020/
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
  "$ite/?v=uu_11_2008,uu_1_2024"
  "$ite/?v"
  "$ite/?v="
  "$ite/?v=uu_19_2016"
  "$ite/?v=uu_11_2008"
  "$ite/?v=uu_1_2024,uu_11_2008"
  "$ite/?v=uu_1_2024,uu_1_2024"
  "$ite/?v=uu_11_2008,uu_19_2016,uu_1_2024"
  "$ite/?v=uu_9_9999"
  "$ite/?v=BAD%20ID"
  "$ite/?v=uu_11_2008,uu_1_2024&pasal=27A"
  "$ite/?dari=uu_11_2008&bandingkan=uu_1_2024"
  "$ite/2016-11-25/?v=uu_11_2008,uu_19_2016"
  /koleksi/bumn/
  '/koleksi/bumn/?v=uu_19_2003,uu_16_2025'
  /koleksi/cipta-kerja/
  '/koleksi/cipta-kerja/?v='
  /koleksi/bank-indonesia/
  '/koleksi/bank-indonesia/?v='
  /koleksi/tidak-ada/2016-11-25/
  '/koleksi/tidak-ada/?v='
  /ruu/
  "$draft/"
  "$draft/ruu_perampasan-aset_2023-05_draft_pemerintah/"
  "$draft/ruu_perampasan-aset_2026-11-19_draft-final/"
  "$draft/ruu_tidak-ada/"
  /ruu/tidak-ada/
  /ruu/tidak-ada/ruu_x/
  "$draft/beda/$older...$newer/"
  "$draft/beda/$older...$newer"
  "$draft/beda/$newer...$older/"
  "$draft/beda/$older...$older/"
  "$draft/beda/$older...ruu_tidak-ada/"
  "$draft/beda/ruu_tidak-ada...$newer/"
  "$draft/beda/$older/"
  "$draft/beda/$older..$newer/"
  "$draft/beda/$older...$newer...$newer/"
  "$draft/beda/${older^^}...$newer/"
  "$draft/beda/"
  "/ruu/tidak-ada/beda/$older...$newer/"
  /cari/
  /cari/hasil/
  '/cari/hasil/?q='
  '/cari/hasil/?q=ite'
  '/cari/hasil/?q=pasal+27+ite'
  '/cari/hasil/?q=uu+11/2008'
  '/cari/hasil/?q=zzzzqqq'
  '/cari/hasil/?q=%3Cscript%3E'
)

# Every ordered pair of versions of three amended laws, on the law page and on the collection page
# (`?v=<left>,<right>`, in either order).
pairs() {
  local page="$1" slug="$2" from to
  shift 2
  for from in "$@"; do
    for to in "$@"; do
      if [ "$from" != "$to" ]; then
        urls+=("$page/?v=$from,$to")
        urls+=("/koleksi/$slug/?v=$from,$to")
      fi
    done
  done
}
pairs /uu/24/2003 mahkamah-konstitusi uu_24_2003 uu_8_2011 perppu_1_2013 uu_7_2020
pairs /uu/4/2009 minerba uu_4_2009 uu_3_2020 uu_2_2025
pairs /uu/19/2003 bumn uu_19_2003 uu_1_2025 uu_16_2025
# an amending law's own page: its text decides where the comparison puts a pasal it does not have
urls+=(
  '/uu/8/2011/?v=uu_24_2003,uu_7_2020'
  '/uu/7/2020/?v=uu_8_2011'
  '/uu/19/2016/?v=uu_11_2008,uu_1_2024'
  '/uu/1/2024/?v=uu_19_2016'
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

rm -f "$out/.h" "$out/.b"
echo "snapshot: $(ls "$out" | wc -l) responses in $out"
