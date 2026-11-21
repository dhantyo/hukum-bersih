# 0008 Law history ("Riwayat") on each law page

Date: 2026-11-21 · Asked for by Dante ("an overview of the same law, which then lists all the changes")

A law and the laws that amend, revoke or enact it form one family. We show it where readers
already are, on the law's own page, instead of a separate page:

- **Base law** (e.g. UU 11/2008): a "Riwayat" timeline — ditetapkan, each amending law in order
  ("perubahan kedua"), revocation, and for a Perppu the law that made it a UU. Under each
  amendment, the pasal it changed (linked to that pasal in the text), inserted and deleted.
  Each changed pasal in the text gets a note "Diubah oleh UU 19/2016 dan UU 1/2024".
- **Amending law** (e.g. UU 19/2016): a banner "Undang-undang ini mengubah UU 11/2008 …"
  linking back to the base law's timeline.
- **Lists**: a "diubah n×" badge.

Pattern taken from legislation.gov.uk ("changes over time") and Fedlex ("Chronologie").

Data: `hukum-bersih relations` (pipeline/src/hukum_bersih/relations.py) reads the titles
("PERUBAHAN KEDUA ATAS UNDANG-UNDANG NOMOR …", "PENCABUTAN …", "PENETAPAN … MENJADI
UNDANG-UNDANG") and the amending law's own instructions ("Ketentuan Pasal 27 diubah",
"disisipkan 2 (dua) pasal, yakni Pasal 45A dan Pasal 45B", "Pasal 9 dihapus") and writes
`relationships` into every record. Recomputed from scratch each run; the importer runs it after
every batch. OCR misreads are fixed only in the extracted pasal *numbers* (4O → 40), never in
the stored text.

Addendum (2026-11-21, for the sample families Minerba, PT, BUMN, Penanaman Modal): a
**"Perubahan" page** per amended law (`/uu/<nomor>/<tahun>/perubahan/`) shows every pasal each
amendment touched, before and after, in the same synopsis rows as the RUU comparison
(`components/SynRow.astro`). `pipeline/src/hukum_bersih/amendments.py` splits an amending law's
Pasal I into its instructions ("Ketentuan Pasal 4 diubah sehingga berbunyi ...") and the new
wording of each pasal; `build-akn` writes them to `web/generated/akn/amendments/`. "Before" is
the original text or the wording of the previous amendment we have. When an amending law's
title says it is e.g. the fourth amendment and we know fewer, the page and the timeline say so
(usually the missing ones are the Cipta Kerja omnibus laws). Pasal numbers read from scanned
texts are checked against the base law's own pasal. Short names ("UU Minerba") are a
`short_name` in the record; an amending law is shown as "Perubahan Kedua UU ITE".

What we gave up (for now):
- No consolidated current text (all amendments applied as one document): only the changed
  pasal are shown, each with its source. A consolidation is a derived document and would need
  the omnibus amendments too.
- Omnibus laws (UU Cipta Kerja amends ~80 laws inside its own articles) are not linked: its
  text is a noisy OCR scan and UU 11/2020 failed to parse (fixed in parser v4, needs a re-run).
- Laws revoked or amended only by a clause inside another law's body (not its title) are not
  linked yet.
- With several targets in one amending law we link the laws but not the per-pasal changes.
