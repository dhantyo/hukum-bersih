"""Command-line entry point: ``hukum-rapih <command>``.

    parse            PDF -> Bluebell text (the format stored in data/)
    explain          which cell of the parser's state table read each line of a law (debugging)
    build-akn        Bluebell text in data/ -> Akoma Ntoso XML (checked against the OASIS schema in CI)
    import-bpk       import regulations from peraturan.bpk.go.id, recording every PDF's sha256
    relations        link amending / revoking / enacting laws; versions of amended laws
    export-corpus    write the web corpus (JSON the website reads) from data/ into a folder
    release          publish a corpus folder as a release the website reads, or switch the live one
    import-pdf       record and convert hand-downloaded PDFs (uploads.py)
    manifest         print a manifest entry for a local file
    reparse-bpk      re-convert texts from the PDFs on archive.org (read only)
    collect-queue    write the file-order queue for the agent routine (file_order.py)
    apply-answers    move the routine's merged answers onto their records (file_order.py)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
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
    parser = argparse.ArgumentParser(prog="hukum-rapih")
    parser.add_argument("--version", action="version", version=__version__)
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("parse", help="PDF -> Bluebell text")
    p.add_argument("pdf", type=Path)
    p.add_argument("--out", type=Path, required=True)

    p = sub.add_parser("explain", help="show how the parser read each line of a law, cached PDF or stored text "
                       "(no OCR)")
    p.add_argument("target", help="a law id (uu_9_2017), or a path to a PDF or a stored text")
    p.add_argument("--from", dest="first", type=int, default=1, metavar="N", help="first line number to show")
    p.add_argument("--to", dest="last", type=int, default=None, metavar="M", help="last line number to show")
    p.add_argument("--state", action="append", default=[], help="only lines read in this state (repeatable)")
    p.add_argument("--cell", action="append", default=[], help="only lines read by this cell (repeatable)")
    p.add_argument("--text", action="store_true", help="for a law id, read the stored text even if a PDF is cached")

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
    p.add_argument("jenis", choices=["uu", "perppu", "pp", "perpres", "keppres", "uud"],
                   help="keppres: only the entries in ONE_OFF; uud: the UUD 1945 and its amendments")
    p.add_argument("--limit", type=int, default=0, help="stop after N regulations done (0 = all)")
    p.add_argument("--delay", type=float, default=3.0, help="seconds between requests")
    p.add_argument("--only", default="", help="comma-separated ids (uu_4_2009,…): just these")
    p.add_argument("--no-text", action="store_true",
                   help="download PDFs and record hashes, but leave texts alone (no conversion)")
    p.add_argument("--check-dir", type=Path, default=None,
                   help="uud: where to write the parsed consolidated text for scripts/check_uud.py")

    p = sub.add_parser("reparse-bpk", help="re-convert texts from the BPK PDFs archived on archive.org")
    p.add_argument("--only", default="", help="comma-separated ids")
    p.add_argument("--limit", type=int, default=0)

    p = sub.add_parser("collect-queue", help="write queue/file-order/<id>.yaml for each law with "
                       "several BPK files and no order yet (downloads them from BPK)")
    p.add_argument("queue", type=Path, help="a checkout of the queue branch")
    p.add_argument("--only", default="", help="comma-separated ids: just these")
    p.add_argument("--delay", type=float, default=3.0, help="seconds between requests")

    sub.add_parser("apply-answers", help="move data/queue-answers/file-order/<id>.yaml onto "
                   "each record's bpk.file_order and delete the answer")

    p = sub.add_parser("export-corpus", help="write the web corpus from data/ into a folder")
    p.add_argument("stage", type=Path, nargs="?",
                   help="the folder to write (created if missing); without it, --publish "
                   "writes into a temporary folder that is deleted afterwards")
    p.add_argument("--publish", type=Path, metavar="CORPUS", default=None,
                   help="then publish the stage into this corpus folder (`release publish`)")
    p.add_argument("--public", type=Path, metavar="DIR", default=None,
                   help="with --publish: also write the active release's law catalog and search "
                        "index into this public folder (web/public), and drop older "
                        "releases from it")

    p = sub.add_parser("release", help="publish a corpus stage as a release, or switch the "
                       "active one")
    corpus_help = "the corpus folder (HUKUM_CORPUS_DIR); default: that variable"
    corpus_default = os.environ.get("HUKUM_CORPUS_DIR") or None
    rel = p.add_subparsers(dest="action", required=True)
    q = rel.add_parser("publish", help="store a stage as a release and make it active; "
                       "prints the release id")
    q.add_argument("stage", type=Path, help="a folder written by export-corpus")
    q.add_argument("--corpus", type=Path, default=corpus_default, help=corpus_help)
    q = rel.add_parser("activate", help="make an already stored release the active one")
    q.add_argument("release", help="a release id printed by `release publish`")
    q.add_argument("--corpus", type=Path, default=corpus_default, help=corpus_help)

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

    if args.command == "explain":
        from .pdf import explain

        try:
            source = explain.resolve(args.target, args.data_dir, args.text)
        except FileNotFoundError as e:
            print(f"explain: {e}", file=sys.stderr)
            return 1
        doc, events = explain.trace(source.lines)
        print(f"# {source.origin}: {len(source.lines)} lines, {doc.pasal_count} pasal")
        for note in source.notes:
            print(f"# note: {note}")
        print(explain.report(explain.select(events, args.first, args.last, args.state, args.cell)))
        return 0

    if args.command == "build-akn":
        from .akn.build import build_peraturan, build_ruu

        ruu = build_ruu(args.data_dir, args.out)
        peraturan = build_peraturan(args.data_dir, args.out)
        print(f"{len(ruu)} RUU versions, {len(peraturan)} regulation versions -> {args.out}")
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
        cache = Path(os.environ["HUKUM_RAPIH_BPK_CACHE"]) if os.environ.get("HUKUM_RAPIH_BPK_CACHE") else None
        if cache:
            cache.mkdir(parents=True, exist_ok=True)
        session, done, failed = Session(args.delay, state=cache and cache / "session.json"), 0, 0
        known = bpk.known_records(args.data_dir)
        archived = bpk.archive_urls(args.data_dir)
        only = [i.strip() for i in args.only.split(",") if i.strip()]

        def items():
            if args.jenis == "uud":           # one entry for five records: import_uud below
                return
            if args.jenis in bpk.ONE_OFF:
                yield from (bpk.Listing(d, int(d.split("/")[2])) for d in bpk.ONE_OFF[args.jenis])
                return
            if not only:
                yield from bpk.listings(session, args.jenis, cache)
            for work in only:
                try:
                    yield bpk.find(session, work)
                except LookupError as e:
                    print(f"FAIL {e}", flush=True)

        try:
            if args.jenis == "uud":
                for line in bpk.import_uud(session, args.data_dir, args.check_dir):
                    print(line, flush=True)
                    failed += line.startswith("FAIL")
                    done += line.startswith("ok")
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

    if args.command == "collect-queue":
        from . import file_order
        from .sources.bpk_session import Challenged, Session

        only = {i.strip() for i in args.only.split(",") if i.strip()} or None
        failed = 0
        try:
            for line in file_order.collect(Session(args.delay), args.data_dir,
                                           args.queue / file_order.QUEUE, only):
                print(line, flush=True)
                failed += line.startswith("FAIL")
        except Challenged as e:
            print(f"STOP Cloudflare: {e}")
            return 1
        return 1 if failed else 0

    if args.command == "apply-answers":
        from . import file_order

        failed = 0
        for line in file_order.apply(args.data_dir):
            print(line, flush=True)
            failed += line.startswith("FAIL")
        return 1 if failed else 0

    if args.command == "import-pdf":
        from .uploads import import_pdf

        url = args.source_url or f"https://{args.source}/"
        return _each([str(p) for p in args.pdfs], lambda p: import_pdf(
            Path(p), args.data_dir, args.source, url))

    if args.command == "relations":
        from .history import build as build_history
        from .relations import build

        print(build(args.data_dir))
        print(build_history(args.data_dir))     # versions and changes of amended laws (0010)
        return 0

    if args.command == "export-corpus":
        from .corpus.export import export_corpus

        if args.stage is None and args.publish is None:
            parser.error("export-corpus needs a stage folder or --publish CORPUS")
        if args.public is not None and args.publish is None:
            parser.error("--public needs --publish")
        for line in export_corpus(args.data_dir, args.stage, args.publish, args.public):
            print(line)
        return 0

    if args.command == "release":
        from .corpus import release

        if args.corpus is None:
            parser.error("release needs --corpus or HUKUM_CORPUS_DIR")
        try:
            if args.action == "publish":
                print(release.publish(args.stage, args.corpus))
            else:
                release.activate(args.release, args.corpus)
                print(args.release)
        except release.ReleaseError as error:
            print(f"release: {error}", file=sys.stderr)
            return 1
        return 0

    if args.command == "manifest":
        from .manifest import entry_for_file

        print(json.dumps(entry_for_file(args.path, args.source_url).to_dict(), indent=2))
        return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
