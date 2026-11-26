#!/usr/bin/env bash
# Delete old corpus releases from a remote, keeping the release just deployed and the one that was
# active before it, so redeploying the previous Worker (which has its release id baked in) always
# finds its files. Run it only after the Worker deploy succeeded.
#
# Nothing is deleted unless both releases are known: the new one must be the remote's active-release
# and have its ready marker, and the previous one must be a valid id different from the new one.
# A missing previous release (first deploy) or previous == new (a re-run) skips the prune.
# Only folders named by a 64-hex id are touched. Safe to re-run: a second run finds nothing to delete.
#
# Usage: prune-releases.sh [--dry-run] <remote> <new-release> <previous-release>
#   <previous-release> may be empty when there was none.

set -euo pipefail

dry_run=false
if [[ "${1:-}" == "--dry-run" ]]; then
    dry_run=true
    shift
fi

usage="usage: prune-releases.sh [--dry-run] <remote> <new-release> <previous-release>"
remote="${1:?$usage}"
new="${2:?$usage}"
previous="${3-}"
id_pattern='^[a-f0-9]{64}$'

if ! [[ "$new" =~ $id_pattern ]]; then
    echo "invalid new release id: $new" >&2
    exit 1
fi

if [[ -z "$previous" ]]; then
    echo "No previous release known. Nothing pruned."
    exit 0
fi
if ! [[ "$previous" =~ $id_pattern ]]; then
    echo "invalid previous release id: $previous" >&2
    exit 1
fi
if [[ "$previous" == "$new" ]]; then
    echo "Previous release equals the new release $new. Nothing pruned."
    exit 0
fi

active="$(rclone cat "$remote/active-release" | tr -d '\n')"
if [[ "$active" != "$new" ]]; then
    echo "Remote active-release is $active, not $new. Nothing pruned." >&2
    exit 1
fi
if [[ "$(rclone cat "$remote/releases/$new/release-id")" != "$new" ]]; then
    echo "Release $new has no ready marker. Nothing pruned." >&2
    exit 1
fi

# Read the whole listing first: if it fails, nothing is deleted.
listing="$(rclone lsf "$remote/releases" --dirs-only)"

echo "Keeping $new (new) and $previous (previous)."
deleted=0
while IFS= read -r entry; do
    [[ -n "$entry" ]] || continue
    id="${entry%/}"
    if ! [[ "$id" =~ $id_pattern ]]; then
        echo "Leaving $entry (not a release id)."
    elif [[ "$id" == "$new" || "$id" == "$previous" ]]; then
        continue
    elif [[ "$dry_run" == true ]]; then
        echo "Would delete releases/$id"
        deleted=$((deleted + 1))
    else
        echo "Deleting releases/$id"
        rclone purge "$remote/releases/$id"
        deleted=$((deleted + 1))
    fi
done <<< "$listing"

if [[ "$dry_run" == true ]]; then
    echo "Dry run: $deleted release(s) would be deleted."
else
    echo "Deleted $deleted release(s)."
fi
