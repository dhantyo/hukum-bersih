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
    fetch_cmd.add_argument(
        "pairs", nargs="+", metavar="DOC_ID URL",
        help="one or more doc id + URL pairs; doc ids follow docs/NAMING.md",
    )
    fetch_cmd.add_argument("--title", help="archive item title (single pair only)")
    fetch_cmd.add_argument("--data-dir", type=Path, default=REPO_ROOT / "data")
    fetch_cmd.add_argument("--no-archive", action="store_true", help="hash only, skip IA upload")
    fetch_cmd.add_argument("--delay", type=float, default=2.0, help="seconds between requests")

    parse_cmd = sub.add_parser("parse", help="convert a regulation/draft PDF to Markdown")
    parse_cmd.add_argument("pdf", type=Path)
    parse_cmd.add_argument("--id", required=True, help="document id (docs/NAMING.md)")
    parse_cmd.add_argument("--out", type=Path, required=True)
    parse_cmd.add_argument("--source-sha256")
    parse_cmd.add_argument("--archive-url")

    retitle_cmd = sub.add_parser(
        "archive-retitle", help="rewrite title/description of archived items (files untouched)"
    )
    retitle_cmd.add_argument("ids", nargs="+")
    retitle_cmd.add_argument("--data-dir", type=Path, default=REPO_ROOT / "data")

    clean_cmd = sub.add_parser(
        "archive-delete", help="delete the files of obsolete archive.org items we uploaded"
    )
    clean_cmd.add_argument("items", nargs="+")

    args = parser.parse_args(argv)
    if args.command == "manifest":
        entry = entry_for_file(args.path, args.source_url, args.archive_url)
        print(json.dumps(entry.to_dict(), indent=2))
    elif args.command == "fetch":
        from .fetch import fetch_and_archive
        from .naming import validate_id

        if len(args.pairs) % 2:
            parser.error("arguments must be DOC_ID URL pairs")
        pairs = list(zip(args.pairs[::2], args.pairs[1::2], strict=True))
        for doc_id, url in pairs:
            if doc_id.startswith(("http://", "https://")) or not url.startswith("http"):
                parser.error(f"expected DOC_ID URL, got {doc_id!r} {url!r}")
            try:
                validate_id(doc_id)
            except ValueError as e:
                parser.error(str(e))
        if args.title and len(pairs) > 1:
            parser.error("--title can only be used with a single pair")
        failures = 0
        for i, (doc_id, url) in enumerate(pairs):
            if i:
                time.sleep(args.delay)
            try:
                res = fetch_and_archive(
                    url, doc_id, args.data_dir, title=args.title, archive=not args.no_archive,
                )
            except Exception as e:  # noqa: BLE001 - keep going: one dead link must not stop the batch
                failures += 1
                print(f"FAILED  {url}\n        {e}")
                continue
            state = "skipped (unchanged)" if res.skipped else "archived"
            print(f"{state}  {doc_id}  {url}\n        sha256={res.entry.sha256} bytes={res.entry.bytes}"
                  f"\n        {res.entry.archive_url}")
        return 1 if failures else 0
    elif args.command == "parse":
        from .manifest import sha256_file
        from .naming import validate_id
        from .parse import parse_pdf, to_markdown

        validate_id(args.id)
        doc = parse_pdf(args.pdf)
        fm = {
            "id": args.id,
            "source_sha256": args.source_sha256 or sha256_file(args.pdf),
            "source_archive_url": args.archive_url,
        }
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(to_markdown(doc, fm))
        print(f"{args.out}: {doc.pasal_count} pasal, {doc.bab_count} BAB")
        if args.source_sha256 and args.source_sha256 != sha256_file(args.pdf):
            print("warning: PDF hash differs from --source-sha256")
            return 1
    elif args.command == "archive-retitle":
        from .fetch import retitle

        failures = 0
        for doc_id in args.ids:
            try:
                meta = retitle(doc_id, args.data_dir)
            except Exception as e:  # noqa: BLE001 - report every item, then fail
                failures += 1
                print(f"FAILED  {doc_id}: {e}")
                continue
            print(f"retitled {doc_id}\n        {meta['title']}")
        return 1 if failures else 0
    elif args.command == "archive-delete":
        from .archive_cleanup import empty_item

        failures = 0
        for ident in args.items:
            try:
                removed = empty_item(ident)
            except Exception as e:  # noqa: BLE001 - report every item, then fail
                failures += 1
                print(f"FAILED  {ident}: {e}")
                continue
            print(f"emptied {ident}: removed {removed or 'nothing (already empty)'}")
        return 1 if failures else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
