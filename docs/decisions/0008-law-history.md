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

What we gave up (for now):
- The text shown is the **original** text. A consolidated current text (all amendments applied)
  is not built; the page says so. Building it needs amendment-law structure parsing first.
- Laws revoked or amended only by a clause inside another law's body (not its title) are not
  linked yet.
- With several targets in one amending law we link the laws but not the per-pasal changes.
