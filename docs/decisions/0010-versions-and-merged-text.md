# 0010 Versions of a law and the merged text

Date: 2026-11-22 · Decided by Dante (merged text in the Koleksi view; the version data is the
UI agent's job); researched and built by Claude

## The version model

Every amended law gets a `history` block in its record (`pipeline/src/hukum_rapih/history.py`,
recomputed with `hukum-rapih relations`):

- **points**: every version of its text, oldest first. The first is the law as enacted
  (`kind: asli`, a stored text). Each amending law adds one (`kind: gabungan`), dated by when
  it took effect (`tanggal_berlaku`, else `tanggal_pengundangan`, else `tanggal_penetapan`;
  `date_basis` says which). Per point: the amending law(s), how many pasal it changed,
  inserted, deleted, amendments before it that we do not have (`missing_before`), pasal whose
  new wording could not be read (`unreadable`), instructions not applied (`not_applied`, each
  marked `affects_wording`), and `complete`.
- **changes**: every change to a pasal: which pasal, `diubah` / `disisipkan` / `dihapus`, by
  which amending law and instruction, at which point, and whether its new wording was read.

The same model as Fedlex's JOLux (Work / Consolidation / LegalResourceImpact) and Laws.Africa's
points in time, in our own words. Point ids follow docs/NAMING.md (`uu_4_2009_2020-06-10`).

A point is **complete** only when no earlier amendment is missing, every changed pasal's
wording was read, and every instruction was applied, except those clearly about the
Penjelasan or a heading. The default is incomplete: an instruction we could not split is taken
to change pasal wording.

The merged texts are not stored: they follow from the original text and the instructions,
which are both in `data/`; the website builds them.

## The merged text (supersedes the "never reconstruct" rule for this one view)

The Koleksi page of a law family (`/koleksi/<slug>/`) opens the **latest version, merged
automatically** from the original law and its amending laws. No Indonesian source publishes
consolidated texts, and readers want to read the law as it stands. The law pages reached from
the year lists and search keep the original transcript of each PDF, unchanged.

The merged text is always labelled as built automatically, not an official consolidation. When
a point is not complete the page says why (missing amendments, unreadable pasal marked where
they are, instructions not applied, listed with their amending law), and keeps showing the
merged text rather than hiding it.

Given up: a merged text is only as good as the amendment parsing; it is not reviewed by a
lawyer. Omnibus amendments (Cipta Kerja) are not linked yet, so families amended only through
them show no merged version.

## Comparing versions inside the reading view

The separate Perubahan page (`/uu/<nomor>/<tahun>/perubahan/`) is gone; its links forward to
the reading view with `?bandingkan=<amending law id>`. Comparison happens where the text is
(`web/src/components/CompareMode.astro`). It always compares the whole law and keeps the reader
where they were: "Diubah oleh UU 3/2020" under a pasal compares the version before that
amendment with the one it made, with that pasal kept in place on screen; "Bandingkan versi" in
the Versi panel compares any two versions. Every changed pasal opens in place and is marked in
the contents. Each column's version is chosen in a module above it, and the columns can be
swapped by dragging (2026-11-22, Dante). The notation follows Fedlex's comparison view (inserted, deleted, reworded, no
counterpart; pasal inserted / deleted / changed). Data: `/koleksi/<slug>/perubahan.json`
(`lib/amendments.ts` `compareData`), fetched only when a comparison is opened.
