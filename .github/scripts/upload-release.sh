#!/usr/bin/env bash
# Upload the active release of a local corpus folder to a remote with rclone, then move the remote's
# active-release pointer. The order is the contract: every file of the release, then its ready
# marker (release-id), then the pointer. A reader that sees the pointer finds a complete release.
# The Pagefind index is left out: the browser reads it from the static assets, never from R2.
# Releases are immutable: re-uploading the same release only fills in what is missing.
#
# Usage: upload-release.sh <corpus-dir> <remote>
# Prints the release id.

set -euo pipefail

corpus="${1:?usage: upload-release.sh <corpus-dir> <remote>}"
remote="${2:?usage: upload-release.sh <corpus-dir> <remote>}"
release="$(tr -d '\n' < "$corpus/active-release")"

if ! [[ "$release" =~ ^[a-f0-9]{64}$ ]]; then
    echo "invalid release id in $corpus/active-release: $release" >&2
    exit 1
fi

prefix="$remote/releases/$release"

if remote_release="$(rclone cat "$prefix/release-id")" &&
   [[ "$remote_release" == "$release" ]]; then
    echo "Release $release already exists. Skipping upload." >&2
else
    rclone copy "$corpus/releases/$release" "$prefix" --immutable --checksum --exclude /release-id --exclude "/pagefind/**" --stats 10s --stats-one-line -v >&2
    rclone copyto "$corpus/releases/$release/release-id" "$prefix/release-id" --immutable --checksum >&2
fi

rclone copyto "$corpus/active-release" "$remote/active-release" --ignore-times >&2

echo "$release"
