"""Import regulation PDFs that a person downloaded by hand (e.g. from peraturan.bpk.go.id in a
browser) and attached to a GitHub release.

Each PDF is matched to an existing record by its file name ("UU Nomor 4 Tahun 2009.pdf",
"uu-no-4-tahun-2009.pdf", "UU_4_2009.pdf", "UU0042009.pdf"), recorded in the source manifest,
archived on archive.org under the version id (docs/NAMING.md), and converted to text with the
same parser as the importer. A PDF for a law we have no record of is reported, not guessed.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from .records import load_record, save_record

JENIS = {"uu": "uu", "undang-undang": "uu", "perppu": "perppu", "pp": "pp", "perpres": "perpres"}


def id_from_filename(name: str) -> str | None:
    """'UU Nomor 4 Tahun 2009.pdf' -> 'uu_4_2009'; None if the name does not say."""
    stem = Path(name).stem.lower().replace("_", " ").replace("-", " ")
    m = re.match(r"\s*(undang undang|uu|perppu|pp|perpres)\s*(?:republik indonesia\s*)?(?:nomor|no\.?)?\s*"
                 r"(\d+[a-z]?)\s*(?:tahun|thn|th\.?)?\s*(\d{4})\b", stem)
    if m:
        return f"{JENIS[m[1].replace(' ', '-')]}_{int(re.match(r'\d+', m[2])[0])}{re.sub(r'^\d+', '', m[2])}_{m[3]}"
    m = re.match(r"\s*(uu|pp)(\d{3})(\d{4})$", stem.replace(" ", ""))     # peraturan.go.id: UU0042009
    if m:
        return f"{m[1]}_{int(m[2])}_{m[3]}"
    return None


def record_path(data_dir: Path, work: str) -> Path | None:
    jenis, _, year = work.split("_")
    p = data_dir / "peraturan" / jenis / year / work / f"{work}.yaml"
    return p if p.exists() else None


def import_pdf(pdf: Path, data_dir: Path, source: str, source_url: str, do_archive: bool = True) -> str:
    """Archive, record and convert one hand-downloaded PDF. ``source``: host it came from
    (peraturan.bpk.go.id); ``source_url``: where it can be found again (page or release asset)."""
    from . import archive
    from .manifest import entry_for_file, manifest_path
    from .sources.peraturan_go_id import convert_pdf

    if not pdf.read_bytes()[:5].startswith(b"%PDF"):
        return f"skip {pdf.name}: not a PDF"
    work = id_from_filename(pdf.name)
    if not work:
        return f"skip {pdf.name}: cannot tell which law from the file name"
    rec_path = record_path(data_dir, work)
    if not rec_path:
        return f"skip {pdf.name}: no record for {work} (import it from peraturan.go.id first)"
    rec = load_record(rec_path)
    version = f"{work}_{rec.get('tanggal_penetapan') or rec['year']}"
    filename = f"{version}.pdf"
    archive_url = f"https://archive.org/download/{work}/{filename}" if do_archive else None
    entry = entry_for_file(pdf, source_url, archive_url, version, pdf.name)
    if do_archive:
        archive.upload(pdf, version, filename, source_url, pdf.name, data_dir)
    manifest = manifest_path(data_dir, f"https://{source}/")
    manifest.parent.mkdir(parents=True, exist_ok=True)
    with manifest.open("a") as f:
        f.write(json.dumps(entry.to_dict(), ensure_ascii=False) + "\n")
    note = convert_pdf(pdf, rec, rec_path.parent, source=source)
    save_record(rec_path, rec)
    return f"ok   {work}: {note}" + (f"; archived {archive_url}" if archive_url else "")
