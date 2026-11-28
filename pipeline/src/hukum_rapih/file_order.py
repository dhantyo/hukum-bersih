"""The file-order queue of the agent routine (decisions 0022, 0023): which BPK files of a law
are joined into its text, and in what order.

    queue branch   queue/file-order/<id>.yaml              what the routine reads: each file's
                   bpk_file_id, filename, pages and the lines of its first and last page
    main           data/queue-answers/file-order/<id>.yaml  its answer, a ``FileOrder``
                   (records.py): order, skip, reason

``collect`` writes the queue on Actions (queue-collect.yml); ``apply`` moves each answer onto
its record once the answer PR is merged (apply-answers.yml). The formats are described in
docs/decisions/0022-agent-routine-for-judgement-calls.md.
"""

from __future__ import annotations

import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

import yaml
from pydantic import ValidationError

from .records import FileOrder, load_record, save_record
from .sources.peraturan_bpk import UUD_BPK_ID, current_order, download, order_problems, record_path
from .yamlio import load_yaml

ANSWERS = Path("queue-answers") / "file-order"   # under data/
QUEUE = Path("queue") / "file-order"             # under a checkout of the queue branch
RECHECK = "file order set (decision 0023)"


# ---- answers -------------------------------------------------------------------------------

def answer_problems(rec: dict | None, answer: object) -> list[str]:
    """Why ``answer`` (the YAML of an answer file) cannot be applied to the law record ``rec``
    (None: no such law in data/); empty when it can."""
    if rec is None:
        return ["no such law in data/"]
    try:
        order = FileOrder.model_validate(answer).model_dump()
    except ValidationError as e:
        return [f"{'.'.join(map(str, err['loc'])) or 'answer'}: {err['msg']}" for err in e.errors()]
    return order_problems(order, (rec.get("bpk") or {}).get("files") or [])


def read_answer(data_dir: Path, answer: Path) -> tuple[Path, dict | None, object]:
    """An answer file's law record (its path, and the record or None) and its YAML."""
    path = record_path(data_dir, answer.stem)
    return path, load_record(path) if path.exists() else None, load_yaml(answer.read_text())


def apply(data_dir: Path) -> Iterator[str]:
    """Move each answer that passes ``answer_problems`` onto its record as ``bpk.file_order``,
    then delete the answer file. The record is marked for the importer to read its files again
    (``recheck``); what the current parser did with the files read before (``reparse_error``,
    ``parser_version_tried``) no longer counts. Running it again changes nothing."""
    for answer in sorted((data_dir / ANSWERS).glob("*.yaml")):
        path, rec, raw = read_answer(data_dir, answer)
        if problems := answer_problems(rec, raw):
            yield f"FAIL {answer.stem}: {'; '.join(problems)}"
            continue
        rec["bpk"]["file_order"] = FileOrder.model_validate(raw).model_dump()
        rec["recheck"] = RECHECK
        rec.pop("reparse_error", None)
        rec.pop("parser_version_tried", None)
        save_record(path, rec)
        answer.unlink()
        yield f"ok   {answer.stem}"


# ---- the queue -----------------------------------------------------------------------------

def needs_order(rec: dict) -> bool:
    """BPK lists several files for the law and no order of the routine covers them. The UUD's
    entry is left out: its second file is the consolidated text, read only to check the merge
    (decision 0027)."""
    bpk = rec.get("bpk") or {}
    return (len(bpk.get("files") or []) > 1 and bpk.get("id") != UUD_BPK_ID
            and not current_order(bpk))


def page_lines_of(pdf: Path, page: int) -> list[str]:
    """Page ``page`` (from 0) of ``pdf`` as the parser reads it: pdf/extract.py, with OCR for a
    scanned page. Only that page is cut out and read, so a long scan costs two pages of OCR."""
    import pymupdf

    from .pdf.extract import clean_lines, page_lines

    with tempfile.TemporaryDirectory() as tmp, pymupdf.open(pdf) as doc, pymupdf.open() as one:
        one.insert_pdf(doc, from_page=page, to_page=page)
        cut = Path(tmp) / "page.pdf"
        one.save(cut)
        stats: dict = {}
        return clean_lines(page_lines(cut, stats), stats)


def file_entry(f: dict, pdf: Path) -> dict:
    import pymupdf

    with pymupdf.open(pdf) as doc:
        pages = doc.page_count
    return {"bpk_file_id": f["bpk_file_id"], "filename": f["filename"], "pages": pages,
            "first_page": page_lines_of(pdf, 0), "last_page": page_lines_of(pdf, pages - 1)}


def queue_entry(session, rec: dict, data_dir: Path) -> dict:
    """A law's queue file: every file BPK lists, downloaded (``download``: BPK, or the mirror)."""
    files = []
    with tempfile.TemporaryDirectory() as tmp:
        for f in rec["bpk"]["files"]:
            pdf = Path(tmp) / f"{f['bpk_file_id']}.pdf"
            pdf.write_bytes(download(session, f, data_dir)[0])
            files.append(file_entry(f, pdf))
    return {"id": rec["id"], "title": rec["title"], "files": files}


def _same_files(queued: dict, rec: dict) -> bool:
    def ids(files: list[dict]) -> list[tuple[int, str]]:
        return [(f["bpk_file_id"], f["filename"]) for f in files]

    return ids(queued["files"]) == ids(rec["bpk"]["files"])


def waiting(data_dir: Path) -> dict[str, dict]:
    """Law id -> record of each law that ``needs_order`` and has no answer waiting on main."""
    answered = {p.stem for p in (data_dir / ANSWERS).glob("*.yaml")}
    records = (load_record(p) for p in sorted((data_dir / "peraturan").glob("*/*/*/*.yaml")))
    return {rec["id"]: rec for rec in records if needs_order(rec) and rec["id"] not in answered}


def collect(session, data_dir: Path, queue_dir: Path, only: set[str] | None = None) -> Iterator[str]:
    """Bring ``queue_dir`` in line with data/: a file for each law ``waiting``, written unless
    one for the same files is there, and the files of other laws removed. ``only``: write just
    these laws (removal is never limited)."""
    from .sources.bpk_session import Challenged

    wanted = waiting(data_dir)
    queue_dir.mkdir(parents=True, exist_ok=True)
    for old in sorted(queue_dir.glob("*.yaml")):
        if old.stem not in wanted:
            old.unlink()
            yield f"gone {old.stem}"
    for work, rec in wanted.items():
        out = queue_dir / f"{work}.yaml"
        if (only and work not in only) or (out.exists() and _same_files(load_yaml(out.read_text()), rec)):
            continue
        try:
            entry = queue_entry(session, rec, data_dir)
        except Challenged:
            raise
        except Exception as e:  # noqa: BLE001 - keep going; the next run tries it again
            yield f"FAIL {work}: {type(e).__name__}: {str(e)[:200]}"
            continue
        part = out.with_suffix(".part")
        part.write_text(yaml.safe_dump(entry, allow_unicode=True, sort_keys=False))
        os.replace(part, out)
        yield f"ok   {work}: {len(entry['files'])} files"
