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

Addendum 2 (2026-11-21, Dante: "too crowded"): the timeline shows each amendment as one line
with counts; the pasal are in a dropdown as number chips. Unrecorded amendments get a dashed
segment. Several versions (revised the same day, Dante: "add or remove version selectors"): one
comparer on the Perubahan page (`components/VersionCompare.astro`): a row of version slots
the reader adds, removes, drags or switches; one column per version, each marking what
changed since the column to its left; filter by pasal; state in the URL. It runs in the
browser on a compact JSON of the changed pasal, so it replaced the static pair pages and the
per-pasal pages.

Search (same day, Dante: "divide the results by hierarchy"): `/cari/` lists (1) short-name
matches with their amending laws nested, (2) number and title matches, (3) full-text hits per
law with the matching pasal, exact phrase first (Pagefind JS API instead of Pagefind UI).
Lists, the metadata panel and the timeline are kept out of the full-text index.
Revocations named in peraturan.go.id's status ("Dicabut Oleh : Undang-Undang Nomor ...") are
now relations too (245).

Collections (same day, Dante: "like a classifier in Notion ... it lists the UU inside
itself"): a law family is its own object, `data/koleksi/<slug>.yaml` (name, subject,
aliases, base law), page `/koleksi/<slug>/` with the laws inside (replaced laws, the base law,
each amendment, gaps) and the version comparer. Members come from the relations. Law pages
link to their collection; search lists collections first. Amended laws without a named
collection get one automatically, titled after their subject. The short name moved from the
law record (`short_name`) to the collection.

Timeline in the collection (same day, Dante: "why does one UU have a timeline and another
not"): the history lives only on the collection page (`components/KoleksiTimeline.astro`):
replaced laws, a Perppu made law, the base law, each amendment (pasal in a dropdown),
revocation. Versions we know exist but lack (an ordinal gap, a law named in a status or title
that we have not imported) are listed as "belum tersedia", with a dashed dot and a dotted
line, and say why. Every law in a collection shows the same box (`KoleksiBox.astro`): its
role and the collection's versions in order, with links to the timeline and the comparer.

What we gave up (for now):
- No consolidated current text (all amendments applied as one document): only the changed
  pasal are shown, each with its source. A consolidation is a derived document and would need
  the omnibus amendments too.
- Omnibus laws (UU Cipta Kerja amends ~80 laws inside its own articles) are not linked: its
  text is a noisy OCR scan and UU 11/2020 failed to parse (fixed in parser v4, needs a re-run).
- Laws revoked or amended only by a clause inside another law's body (not its title) are not
  linked yet.
- With several targets in one amending law we link the laws but not the per-pasal changes.
