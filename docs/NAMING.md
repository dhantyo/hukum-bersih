# Naming rule for documents

This rule applies everywhere: archive.org, file names in `data/`, ids in `ruu.yaml`, and site
URLs. It replaces the example file names in `docs/BRIEF.md` §6.1 and §6.3.

Every document gets one **doc id**. The same id is used for the Internet Archive item, the
archived file name, the Markdown text file, and the `id` in `ruu.yaml`. The original file name
and URL are never lost: they are kept in the source manifest and in the archive item's metadata.

## Format

Lowercase letters, digits and hyphens only. Dates are ISO and only as precise as we know them
(`2023`, `2023-05`, `2026-11-19`).

| Document | Doc id pattern | Example |
|---|---|---|
| RUU document | `ruu-<slug>-<date>-<type>[-<who>][-<n>]` | `ruu-perampasan-aset-2026-11-19-draft-ruu-final` |
| Enacted regulation | `<jenis>-<nomor>-<tahun>` | `uu-8-2010`, `pp-35-2021` |

- `<slug>`: the RUU folder name under `data/ruu/` (short topic, e.g. `perampasan-aset`).
- `<date>`: the document's own date if known; otherwise the date it was posted.
- `<who>`: optional, when the type alone is ambiguous: `pemerintah`, `dpr`, `bkd`, a media name.
- `<n>`: `-1`, `-2`, … when one entry has several files (e.g. a DIM split into four PDFs).
- Versions known to exist but never found still get a doc id, so they can be referred to.

### RUU document types

| `<type>` | DPR label (`menuAkd.title`) |
|---|---|
| `draft-ruu` | Draft RUU |
| `draft-ruu-final` | Draft RUU Final |
| `naskah-akademik` | Draft NA |
| `naskah-urgensi` | Naskah Urgensi |
| `dim` | Daftar Inventaris Masalah (DIM) |
| `surat-presiden` | Surat Presiden |
| `laporan-komisi` | Laporan Komisi |
| `tanggapan-pemerintah` | Tanggapan Pemerintah |
| `pandangan-mini-fraksi` | Pandangan Mini Fraksi |
| `risalah-rapat` | Risalah Rapat |
| `laporan-singkat` | Laporan Singkat |
| `bahan-narasumber` | Bahan Narasumber |
| `dokumen-pendukung` | Dokumen Pendukung Lain |

## Where the id shows up

| Place | Name |
|---|---|
| Internet Archive item | `hukum-bersih-<doc id>` |
| Archived file | `<doc id>.pdf` (original extension, lowercased) |
| RUU version text | `data/ruu/<slug>/versions/<doc id>.md` |
| Regulation text | `data/peraturan/<jenis>/<tahun>/<doc id>.md` |
| Source manifest line | `doc_id` field (plus `original_filename` from the source) |
| Site page | `/ruu/<slug>/<doc id>/`, `/<jenis>/<tahun>/<doc id>/` |

Examples:

```
https://archive.org/download/hukum-bersih-ruu-perampasan-aset-2026-11-19-draft-ruu-final/ruu-perampasan-aset-2026-11-19-draft-ruu-final.pdf
data/ruu/perampasan-aset/versions/ruu-perampasan-aset-2023-05-draft-ruu-pemerintah.md
data/peraturan/uu/2010/uu-8-2010.md
```
