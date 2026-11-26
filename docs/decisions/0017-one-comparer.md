# 0017 One comparer for laws and collections

Date: 2026-11-26 · Decided by: the operator; change by Claude

## What

`web-solid/` has one comparer for the versions of an amended law. The law page (decision 0010: the
comparison inside the reading view) and the collection page use the same mapping, the same
chooser, the same marks and the same block. The draft synopsis (decision 0006) stays its own view:
it pairs by content similarity, not by number.

- **Mapping.** `lib/compare.ts` turns the published pair records (`collections/<slug>/comparisons/`)
  into rows: one per changed pasal, one cell per column, each cell a list of lines made of
  pieces (kept, inserted, struck, reworded, repealed, absent). `server/comparison.ts` reads the
  pairs of neighbouring columns. The law page then places the rows in its own text
  (`placeInText`); the collection page lists them.
- **Pairing.** Lines are paired by their number first, everywhere (the pair record's `numbered`
  field, else its `lines`). Before this, only the law page did; the collection page paired by
  position, so "8. Dihapus." could sit beside a different item. Every pair is read older version
  first, whichever column each version stands in, because only those files carry `numbered`;
  the columns are then filled from the side each version stands for.
- **Address.** One query for both pages: `?v=a,b,c`, the versions left to right (a GET form
  repeats the field; both read the same). One version stands for it against the version before
  it (the first against the next); an empty `?v=` stands for the first against the latest.
  `?pasal=` narrows a collection page to one pasal. The old forms (`?bandingkan`, `?dari`) and
  the Perubahan page (`/uu/<nomor>/<tahun>/perubahan/`, which only forwarded to
  `?bandingkan`) are gone, as is the `perubahanTarget` field of the law record. Links the
  pipeline writes (`corpus/timeline.py`) use `?v=`. Old shared links stop working.
- **Layout.** Two columns is the default. With two, the lines of both sides sit level and, in
  the reading view, give way to one merged run where the text is narrower than two columns (a
  container query). More columns are one per version: wrapped, each named, in the reading view;
  in a row that scrolls sideways (`ScrollRow`, with a header row of version names) on the
  collection page. The chooser is the same one in both: reorder by drag or keys, change a
  version in its picker, remove a column, add one.
- **Anchors.** A compared pasal that the text lacks, and every row of the collection list, has
  `id="cmp-pasal-<key>"`.

## Why

The two views read the same records and paired by the same rule in principle, but were built
twice and had drifted: different pairing, different ways to choose versions, different styling.
One component removes the drift and the second copy of every fix.

## What we gave up

- Old comparison links. Nothing links to them from outside the site we know of, and keeping four
  address forms made every control double its code.
- The swap button between the two versions of the law page's chooser: dragging a column (or Space
  and the arrows on its handle) does the same.
- The pipeline still writes the newer-to-older pair files. Nothing reads them now; dropping them
  would shrink the corpus by about half of its comparison files.
