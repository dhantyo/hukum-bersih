"""Command-line entry point. Subcommands are added per milestone (M2: dpr, M3: peraturan)."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from . import __version__
from .manifest import entry_for_file

REPO_ROOT = Path(__file__).resolve().parents[3]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="hukum-bersih")
    parser.add_argument("--version", action="version", version=__version__)
    sub = parser.add_subparsers(dest="command", required=True)

    hash_cmd = sub.add_parser("manifest", help="print a manifest entry for a local file")
    hash_cmd.add_argument("path", type=Path)
    hash_cmd.add_argument("--source-url", required=True)
    hash_cmd.add_argument("--archive-url")

    fetch_cmd = sub.add_parser(
        "fetch", help="download URLs, archive them on the Internet Archive, record in manifests"
    )
    fetch_cmd.add_argument("urls", nargs="+")
    fetch_cmd.add_argument("--item", help="IA item id (only with a single URL)")
    fetch_cmd.add_argument("--title")
    fetch_cmd.add_argument("--data-dir", type=Path, default=REPO_ROOT / "data")
    fetch_cmd.add_argument("--no-archive", action="store_true", help="hash only, skip IA upload")
    fetch_cmd.add_argument("--delay", type=float, default=2.0, help="seconds between requests")

    args = parser.parse_args(argv)
    if args.command == "manifest":
        entry = entry_for_file(args.path, args.source_url, args.archive_url)
        print(json.dumps(entry.to_dict(), indent=2))
    elif args.command == "fetch":
        from .fetch import fetch_and_archive

        if args.item and len(args.urls) > 1:
            parser.error("--item can only be used with a single URL")
        failures = 0
        for i, url in enumerate(args.urls):
            if i:
                time.sleep(args.delay)
            try:
                res = fetch_and_archive(
                    url, args.data_dir, item=args.item, title=args.title,
                    archive=not args.no_archive,
                )
            except Exception as e:  # noqa: BLE001 - keep going: one dead link must not stop the batch
                failures += 1
                print(f"FAILED  {url}\n        {e}")
                continue
            state = "skipped (unchanged)" if res.skipped else "archived"
            print(f"{state}  {url}\n        sha256={res.entry.sha256} bytes={res.entry.bytes}"
                  f"\n        {res.entry.archive_url}")
        return 1 if failures else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
