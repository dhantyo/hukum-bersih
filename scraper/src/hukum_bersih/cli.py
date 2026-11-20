"""Command-line entry point. Subcommands are added per milestone (M2: dpr, M3: peraturan)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from . import __version__
from .manifest import entry_for_file


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="hukum-bersih")
    parser.add_argument("--version", action="version", version=__version__)
    sub = parser.add_subparsers(dest="command", required=True)

    hash_cmd = sub.add_parser("manifest", help="print a manifest entry for a local file")
    hash_cmd.add_argument("path", type=Path)
    hash_cmd.add_argument("--source-url", required=True)
    hash_cmd.add_argument("--archive-url")

    args = parser.parse_args(argv)
    if args.command == "manifest":
        entry = entry_for_file(args.path, args.source_url, args.archive_url)
        print(json.dumps(entry.to_dict(), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
