"""The headings of the pages (``web-solid/src/lib/titles.ts``, with the two labels it uses from
``web/src/lib/labels.ts``): a search result shows the heading of the page it belongs to.
"""

from __future__ import annotations

from typing import Any

_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus",
          "September", "Oktober", "November", "Desember"]

DOC_TYPE = {
    "draft": "Draf RUU",
    "draft-final": "Draf RUU Final",
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


def tanggal(date: str) -> str:
    """"2026-11-19" -> "19 November 2026", "2023-05" -> "Mei 2023", "2008" -> "2008"."""
    year, month, day = [*date.split("-"), "", ""][:3]
    if not month:
        return year
    name = _BULAN[int(month) - 1]
    return f"{int(day)} {name} {year}" if day else f"{name} {year}"


def law_heading(subject: str | None, title: str) -> str:
    """The heading a law page shows: its subject, or the full title when it has none."""
    return subject or title


def draft_document_title(document: dict[str, Any]) -> str:
    """"Draf RUU · Mei 2023": the heading of a draft document page."""
    kind = document["type"]
    return f"{DOC_TYPE.get(kind, kind)} · {tanggal(document['date'])}"
