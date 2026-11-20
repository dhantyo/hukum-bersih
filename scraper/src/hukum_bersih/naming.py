"""Ids and titles, following docs/NAMING.md."""

from __future__ import annotations

import re
from pathlib import Path

import yaml

PART = r"[a-z0-9]+(?:-[a-z0-9]+)*"
ID_RE = re.compile(rf"^{PART}(?:_{PART})*$")
DATE = r"\d{4}(?:-\d{2}){0,2}"
# <jenis>_<nomor>_<tahun>[_<date>]
REGULATION_RE = re.compile(
    rf"^(?P<work>(?P<jenis>[a-z]+(?:-[a-z]+)*)_(?P<nomor>\d+[a-z]?)_(?P<tahun>\d{{4}}))"
    rf"(?:_(?P<date>{DATE}))?$"
)
# ruu_<slug>_<date>_<type>[_<who>][_<n>]
RUU_DOC_RE = re.compile(
    rf"^ruu_(?P<slug>{PART})_(?P<date>{DATE})_(?P<type>{PART})"
    rf"(?:_(?P<who>[a-z]+(?:-[a-z]+)*))?(?:_(?P<n>\d+))?$"
)
IA_MAX = 100

JENIS_TITLE = {
    "uu": "Undang-Undang",
    "perppu": "Peraturan Pemerintah Pengganti Undang-Undang",
    "pp": "Peraturan Pemerintah",
    "perpres": "Peraturan Presiden",
    "keppres": "Keputusan Presiden",
    "inpres": "Instruksi Presiden",
}

# Full label (descriptions) and short label (titles, where the bill's short name comes first).
RUU_TYPE_TITLE = {
    "draft": "Naskah RUU",
    "draft-final": "Naskah RUU Final",
    "naskah-akademik": "Naskah Akademik",
    "naskah-urgensi": "Naskah Urgensi",
    "dim": "Daftar Inventaris Masalah (DIM)",
    "surat-presiden": "Surat Presiden",
    "laporan-komisi": "Laporan Komisi",
    "tanggapan-pemerintah": "Tanggapan Pemerintah",
    "pandangan-mini-fraksi": "Pandangan Mini Fraksi",
    "risalah-rapat": "Risalah Rapat",
    "laporan-singkat": "Laporan Singkat",
    "bahan-narasumber": "Bahan Narasumber",
    "dokumen-pendukung": "Dokumen Pendukung",
}

RUU_TYPE_SHORT = {**RUU_TYPE_TITLE, "draft": "Naskah", "draft-final": "Naskah Final", "dim": "DIM"}

BULAN = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]


def validate_id(doc_id: str) -> str:
    if not ID_RE.match(doc_id) or len(doc_id) > IA_MAX:
        raise ValueError(
            f"invalid id {doc_id!r}: lowercase parts joined by '_', words inside a part by '-', "
            f"at most {IA_MAX} characters (see docs/NAMING.md)"
        )
    if doc_id.startswith("ruu_"):
        m = RUU_DOC_RE.match(doc_id)
        if not m or m["type"] not in RUU_TYPE_TITLE:
            raise ValueError(
                f"invalid RUU document id {doc_id!r}: expected "
                f"ruu_<slug>_<date>_<type>[_<who>][_<n>] with type in {sorted(RUU_TYPE_TITLE)}"
            )
    elif not REGULATION_RE.match(doc_id):
        raise ValueError(
            f"invalid regulation id {doc_id!r}: expected <jenis>_<nomor>_<tahun>[_<YYYY-MM-DD>], "
            "e.g. uu_11_2008 or uu_11_2008_2008-04-21"
        )
    return doc_id


def archive_item(doc_id: str) -> str:
    """archive.org item: the regulation (work) for a regulation version, else the document."""
    validate_id(doc_id)
    if doc_id.startswith("ruu_"):
        return doc_id
    return REGULATION_RE.match(doc_id)["work"]


def tanggal(date: str) -> str:
    """'2026-11-19' -> '19 November 2026', '2023-05' -> 'Mei 2023', '2008' -> '2008'."""
    parts = date.split("-")
    if len(parts) == 1:
        return parts[0]
    bulan = BULAN[int(parts[1]) - 1]
    return f"{bulan} {parts[0]}" if len(parts) == 2 else f"{int(parts[2])} {bulan} {parts[0]}"


def _ruu_record(data_dir: Path, slug: str) -> dict:
    path = data_dir / "ruu" / slug / "ruu.yaml"
    return yaml.safe_load(path.read_text()) if path.exists() else {}


def _ruu_parts(doc_id: str, data_dir: Path) -> tuple[re.Match, dict, dict]:
    m = RUU_DOC_RE.match(doc_id)
    rec = _ruu_record(data_dir, m["slug"])
    doc = next((d for d in rec.get("documents", []) if d.get("id") == doc_id), {})
    return m, rec, doc


def _ruu_label(m: re.Match, table: dict[str, str]) -> str:
    label = table[m["type"]]
    if m["who"]:
        label += f" {m['who'].replace('-', ' ').title()}"
    if m["n"]:
        label += f" bagian {m['n']}"
    return label


def default_title(doc_id: str, data_dir: Path) -> str:
    """Short card title, most important words first: 'RUU Perampasan Aset – Naskah Final
    (19 November 2026)'. Regulations get the citation; the importer prepends the short name
    ('UU ITE – Undang-Undang Nomor 11 Tahun 2008') when it knows it."""
    validate_id(doc_id)
    if doc_id.startswith("ruu_"):
        m, rec, _ = _ruu_parts(doc_id, data_dir)
        short = rec.get("short_name") or f"RUU {m['slug'].replace('-', ' ').title()}"
        return f"{short} – {_ruu_label(m, RUU_TYPE_SHORT)} ({tanggal(m['date'])})"
    m = REGULATION_RE.match(doc_id)
    jenis = JENIS_TITLE.get(m["jenis"], m["jenis"].upper())
    return f"{jenis} Nomor {m['nomor'].upper()} Tahun {m['tahun']}"


def full_title(doc_id: str, data_dir: Path) -> str:
    """Complete name for descriptions: 'Naskah RUU Final – RUU tentang … (19 November 2026)'.
    Uses the bill's title as it was at the time (``ruu_title`` on the document) if recorded."""
    validate_id(doc_id)
    if doc_id.startswith("ruu_"):
        m, rec, doc = _ruu_parts(doc_id, data_dir)
        ruu_title = doc.get("ruu_title") or rec.get("title") or default_title(doc_id, data_dir)
        return f"{_ruu_label(m, RUU_TYPE_TITLE)} – {ruu_title} ({tanggal(m['date'])})"
    return default_title(doc_id, data_dir)
