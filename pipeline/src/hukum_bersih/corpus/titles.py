"""The headings of the pages (``web-solid/src/lib/titles.ts``, with the two labels it uses from
``web/src/lib/labels.ts``): a search result shows the heading of the page it belongs to.
"""

from __future__ import annotations

import re
from typing import Any

_MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus",
           "September", "Oktober", "November", "Desember"]
_NUMBER = re.compile(r"[0-9]+")

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
    """"2026-11-19" -> "19 November 2026", "2023-05" -> "Mei 2023", "2008" -> "2008"
    (``tanggal`` in ``labels.ts``, which prints "undefined" and "NaN" for a malformed date)."""
    year, month, day = [*date.split("-"), None, None][:3]
    if not month:
        return year
    index = int(month) - 1 if _NUMBER.fullmatch(month) else -1
    name = _MONTHS[index] if 0 <= index < len(_MONTHS) else "undefined"
    if not day:
        return f"{name} {year}"
    return f"{int(day) if _NUMBER.fullmatch(day) else 'NaN'} {name} {year}"


def law_heading(subject: str | None, title: str) -> str:
    """The heading a law page shows: its subject, or the full title when it has none."""
    return subject or title


def draft_document_title(document: dict[str, Any]) -> str:
    """"Draf RUU · Mei 2023": the heading of a draft document page."""
    kind = document["type"]
    return f"{DOC_TYPE.get(kind, kind)} · {tanggal(document['date'])}"
