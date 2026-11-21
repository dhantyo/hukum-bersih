"""Command-line entry point: ``hukum-bersih <command>``.

    fetch            download sources, archive them on archive.org, record in manifests
    parse            PDF -> Bluebell text (the format stored in data/)
    build-akn        Bluebell text in data/ -> Akoma Ntoso XML (+ amendment JSON) for the website
    relations        link amending / revoking / enacting laws
    import-pdf       archive, record and convert hand-downloaded PDFs (uploads.py)
    manifest         print a manifest entry for a local file
    archive-retitle  rewrite titles/descriptions of archived items (files untouched)
    archive-delete   empty obsolete archive.org items we uploaded
"""

from __future__ import annotations

import argparse
import json
import time
from collections.abc import Callable, Iterable
from pathlib import Path

from . import __version__

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / "data"


def _each(items: Iterable[str], action: Callable[[str], str], delay: float = 0) -> int:
    """Run ``action`` per item, report each result, keep going on errors, fail at the end."""
    failures = 0
    for i, item in enumerate(items):
        if i and delay:
            time.sleep(delay)
        try:
            print(action(item))
        except Exception as e:  # noqa: BLE001 - one bad item must not stop the batch
            failures += 1
            print(f"FAILED  {item}: {e}")
    return 1 if failures else 0


def _pairs(parser: argparse.ArgumentParser, values: list[str]) -> list[tuple[str, str]]:
    from .naming import validate_id

    if len(values) % 2:
        parser.error("arguments must be ID URL pairs")
    pairs = list(zip(values[::2], values[1::2], strict=True))
    for doc_id, url in pairs:
        if not url.startswith(("http://", "https://")):
            parser.error(f"expected ID URL, got {doc_id!r} {url!r}")
        try:
            validate_id(doc_id)
        except ValueError as e:
            parser.error(str(e))
    return pairs


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="hukum-bersih")
    parser.add_argument("--version", action="version", version=__version__)
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("fetch", help="download, archive on archive.org, record in manifests")
    p.add_argument("pairs", nargs="+", metavar="ID URL", help="id + URL pairs (docs/NAMING.md)")
    p.add_argument("--title", help="archive.org title (single pair only)")
    p.add_argument("--no-archive", action="store_true", help="hash only, skip archive.org")
    p.add_argument("--delay", type=float, default=2.0, help="seconds between requests")

    p = sub.add_parser("parse", help="PDF -> Bluebell text")
    p.add_argument("pdf", type=Path)
    p.add_argument("--out", type=Path, required=True)

    p = sub.add_parser("build-akn", help="data/ Bluebell text -> Akoma Ntoso XML")
    p.add_argument("--out", type=Path, required=True)

    p = sub.add_parser("import-peraturan", help="import regulations from peraturan.go.id")
    p.add_argument("jenis", choices=["uu", "perppu", "pp", "perpres"])
    p.add_argument("--limit", type=int, default=0, help="stop after N new imports (0 = all)")
    p.add_argument("--delay", type=float, default=2.0, help="seconds between requests")
    p.add_argument("--reparse", action="store_true",
                   help="re-convert already imported texts made by an older parser version")
    p.add_argument("--only", default="", help="comma-separated ids: re-convert just these")

    p = sub.add_parser("archive-pending",
                       help="archive recorded regulation PDFs not yet on archive.org")
    p.add_argument("--limit", type=int, default=150)
    p.add_argument("--delay", type=float, default=2.0)

    sub.add_parser("relations", help="recompute amends/revokes/enacts links between regulations")

    p = sub.add_parser("import-pdf", help="archive, record and convert hand-downloaded PDFs")
    p.add_argument("pdfs", nargs="+", type=Path, help="named like 'UU Nomor 4 Tahun 2009.pdf'")
    p.add_argument("--source", default="peraturan.bpk.go.id", help="host the PDFs came from")
    p.add_argument("--source-url", default="", help="where they can be found again "
                   "(default: https://<source>/)")
    p.add_argument("--no-archive", action="store_true")

    p = sub.add_parser("manifest", help="print a manifest entry for a local file")
    p.add_argument("path", type=Path)
    p.add_argument("--source-url", required=True)

    p = sub.add_parser("archive-retitle", help="rewrite archive.org titles (files untouched)")
    p.add_argument("ids", nargs="+")

    p = sub.add_parser("archive-delete", help="empty obsolete archive.org items we uploaded")
    p.add_argument("items", nargs="+")

    args = parser.parse_args(argv)

    if args.command == "fetch":
        from .fetch import fetch_and_archive

        pairs = _pairs(parser, args.pairs)
        if args.title and len(pairs) > 1:
            parser.error("--title can only be used with a single pair")
        urls = dict(pairs)

        def fetch(doc_id: str) -> str:
            r = fetch_and_archive(urls[doc_id], doc_id, args.data_dir, args.title,
                                  do_archive=not args.no_archive)
            state = "skipped (unchanged)" if r.skipped else "archived"
            return (f"{state}  {doc_id}  {urls[doc_id]}\n        sha256={r.entry.sha256} "
                    f"bytes={r.entry.bytes}\n        {r.entry.archive_url}")

        return _each(urls, fetch, args.delay)

    if args.command == "parse":
        from .akn.bluebell import to_bluebell
        from .pdf.structure import parse_pdf

        doc = parse_pdf(args.pdf)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(to_bluebell(doc))
        print(f"{args.out}: {doc.pasal_count} pasal, {doc.bab_count} BAB")
        return 0

    if args.command == "build-akn":
        from .akn.build import build_peraturan, build_ruu

        ruu = build_ruu(args.data_dir, args.out)
        from .amendments import build as build_amendments

        peraturan = build_peraturan(args.data_dir, args.out)
        amending = build_amendments(args.data_dir, args.out)
        print(f"{len(ruu)} RUU versions, {len(peraturan)} regulation versions, "
              f"{amending} amending laws split into instructions -> {args.out}")
        return 0

    if args.command == "import-peraturan":
        from .sources import peraturan_go_id as src

        client, done = src.Client(args.delay), 0
        if args.reparse:
            only = {i.strip() for i in args.only.split(",") if i.strip()} or None
            for line in src.reparse(client, args.jenis, args.data_dir, only):
                print(line, flush=True)
                if line.startswith("ok"):
                    done += 1
                    if args.limit and done >= args.limit:
                        break
            return 0
        for item in src.listings(client, args.jenis):
            try:
                line = src.import_one(client, item, args.jenis, args.data_dir)
            except Exception as e:  # noqa: BLE001 - keep going; the run is resumable
                line = f"FAIL {item.detail}: {e}"
            print(line, flush=True)
            if line.startswith("ok"):
                done += 1
                if args.limit and done >= args.limit:
                    break
        return 0

    if args.command == "archive-pending":
        from .fetch import fetch_and_archive, pending

        todo = {p.version: p for p in pending(args.data_dir)[: args.limit]}
        print(f"{len(todo)} PDF(s) to archive")

        def archive_one(version: str) -> str:
            p = todo[version]
            r = fetch_and_archive(p.url, version, args.data_dir, p.title)
            return f"archived {r.item}  {r.entry.archive_url}"

        return _each(todo, archive_one, args.delay)

    if args.command == "import-pdf":
        from .uploads import import_pdf

        url = args.source_url or f"https://{args.source}/"
        return _each([str(p) for p in args.pdfs], lambda p: import_pdf(
            Path(p), args.data_dir, args.source, url, do_archive=not args.no_archive))

    if args.command == "relations":
        from .relations import build

        print(build(args.data_dir))
        return 0

    if args.command == "manifest":
        from .manifest import entry_for_file

        print(json.dumps(entry_for_file(args.path, args.source_url).to_dict(), indent=2))
        return 0

    if args.command == "archive-retitle":
        from .archive import retitle

        return _each(args.ids, lambda i: f"retitled {i}\n        "
                     f"{retitle(i, args.data_dir)['title']}")

    if args.command == "archive-delete":
        from .archive import empty_item

        return _each(args.items, lambda i: f"emptied {i}: removed {empty_item(i) or 'nothing'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
