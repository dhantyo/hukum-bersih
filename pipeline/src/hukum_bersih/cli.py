"""Command-line entry point: ``hukum-bersih <command>``.

    parse            PDF -> Bluebell text (the format stored in data/)
    build-akn        Bluebell text in data/ -> Akoma Ntoso XML (+ amendment JSON) for the website
    import-bpk       import regulations from peraturan.bpk.go.id, recording every PDF's sha256
    relations        link amending / revoking / enacting laws
    import-pdf       record and convert hand-downloaded PDFs (uploads.py)
    manifest         print a manifest entry for a local file
    reparse-bpk      re-convert texts from the PDFs on archive.org (read only)
"""

from __future__ import annotations

import argparse
import json
import os
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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="hukum-bersih")
    parser.add_argument("--version", action="version", version=__version__)
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    sub = parser.add_subparsers(dest="command", required=True)

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

    p = sub.add_parser("import-bpk", help="import regulations from peraturan.bpk.go.id: "
                       "metadata, PDF hashes, text for records without one")
    p.add_argument("jenis", choices=["uu", "perppu", "pp", "perpres"])
    p.add_argument("--limit", type=int, default=0, help="stop after N regulations done (0 = all)")
    p.add_argument("--delay", type=float, default=3.0, help="seconds between requests")
    p.add_argument("--only", default="", help="comma-separated ids (uu_4_2009,…): just these")
    p.add_argument("--no-text", action="store_true",
                   help="download PDFs and record hashes, but leave texts alone (no conversion)")

    p = sub.add_parser("reparse-bpk", help="re-convert texts from the BPK PDFs archived on archive.org")
    p.add_argument("--only", default="", help="comma-separated ids")
    p.add_argument("--limit", type=int, default=0)

    sub.add_parser("relations", help="recompute amends/revokes/enacts links between regulations")

    p = sub.add_parser("import-pdf", help="record and convert hand-downloaded PDFs")
    p.add_argument("pdfs", nargs="+", type=Path, help="named like 'UU Nomor 4 Tahun 2009.pdf'")
    p.add_argument("--source", default="peraturan.bpk.go.id", help="host the PDFs came from")
    p.add_argument("--source-url", default="", help="where they can be found again "
                   "(default: https://<source>/)")

    p = sub.add_parser("manifest", help="print a manifest entry for a local file")
    p.add_argument("path", type=Path)
    p.add_argument("--source-url", required=True)

    args = parser.parse_args(argv)

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
        from .closing import build as build_closing

        closings = build_closing(args.data_dir, args.out)
        print(f"{len(ruu)} RUU versions, {len(peraturan)} regulation versions, "
              f"{amending} amending laws split into instructions, {closings} closings read -> {args.out}")
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

    if args.command == "import-bpk":
        from .sources import peraturan_bpk as bpk
        from .sources.bpk_session import Challenged, Session

        # kept between the workflow's batches (one process each): clearance, listing pages
        cache = Path(os.environ["HUKUM_BERSIH_BPK_CACHE"]) if os.environ.get("HUKUM_BERSIH_BPK_CACHE") else None
        if cache:
            cache.mkdir(parents=True, exist_ok=True)
        session, done, failed = Session(args.delay, state=cache and cache / "session.json"), 0, 0
        known = bpk.known_records(args.data_dir)
        archived = bpk.archive_urls(args.data_dir)
        only = [i.strip() for i in args.only.split(",") if i.strip()]

        def items():
            if not only:
                yield from bpk.listings(session, args.jenis, cache)
            for work in only:
                try:
                    yield bpk.find(session, work)
                except LookupError as e:
                    print(f"FAIL {e}", flush=True)

        try:
            for item in items():
                try:
                    line = bpk.import_one(session, item, args.jenis, args.data_dir, known,
                                          cache=archived, no_text=args.no_text)
                except Challenged:
                    raise
                except Exception as e:  # noqa: BLE001 - keep going; the run is resumable
                    failed += 1
                    line = f"FAIL {item.path}: {type(e).__name__}: {str(e)[:300]}"
                if not line.startswith("skip"):
                    print(line, flush=True)
                if line.startswith("ok"):
                    done += 1
                    if args.limit and done >= args.limit:
                        break
        except Challenged as e:
            print(f"STOP Cloudflare: {e}")
            return 1
        print(f"done: {done} imported/updated, {failed} failed, "
              f"{session.clearances} Cloudflare clearance(s)")
        return 0

    if args.command == "reparse-bpk":
        from .sources import peraturan_bpk as bpk

        only = {i.strip() for i in args.only.split(",") if i.strip()} or None
        done = failed = 0
        for line in bpk.reparse(args.data_dir, only):
            print(line, flush=True)
            done += line.startswith("ok")
            failed += line.startswith("FAIL")
            if args.limit and done >= args.limit:
                break
        print(f"done: {done} reparsed, {failed} failed")
        return 0

    if args.command == "import-pdf":
        from .uploads import import_pdf

        url = args.source_url or f"https://{args.source}/"
        return _each([str(p) for p in args.pdfs], lambda p: import_pdf(
            Path(p), args.data_dir, args.source, url))

    if args.command == "relations":
        from .relations import build

        print(build(args.data_dir))
        return 0

    if args.command == "manifest":
        from .manifest import entry_for_file

        print(json.dumps(entry_for_file(args.path, args.source_url).to_dict(), indent=2))
        return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
