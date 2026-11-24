#!/usr/bin/env bash
# Build and publish a full corpus release from the repo data, the way README.md describes.
# Usage: scripts/build-snapshot-corpus.sh <workdir>   (run from web-solid/ after `pnpm run build`)
# Creates <workdir>/stage (the export tree) and <workdir>/corpus (a HUKUM_CORPUS_DIR) and prints the release id.
# The release id hashes every released file, so two builds with the same id are byte-identical.
# Needs the Astro app's ignored folders (web/node_modules, web/generated).
set -euo pipefail
work="$(realpath -m "${1:?usage: build-snapshot-corpus.sh <workdir>}")"
rm -rf "$work"
mkdir -p "$work/stage" "$work/corpus"
stage="$work/stage"
export HUKUM_CORPUS_DIR="$work/corpus"
unset HUKUM_CORPUS_REMOTE
pnpm --silent run export-law --all "$stage" >&2
pnpm --silent run export-collections "$stage" >&2
pnpm --silent run export-drafts "$stage" >&2
pnpm --silent run export-catalog "$stage" >&2
pnpm --silent run index-corpus "$stage" >&2
pnpm --silent run corpus-release publish "$stage" | tee "$work/release-id"
