# 0006 Comparisons are shown as a synopsis

Date: 2026-11-20 · Decided by: Dante, after looking at how others do it

Comparing two versions is a solved presentation problem: parliaments use a side-by-side table
aligned by provision. Germany's *Synopse* ("Geltendes Recht | Neues Recht", one column per
stage in longer ones), the EU's four-column trilogue documents, buzer.de (a.F. | n.F.), and
Indonesia's own DIM tables all work this way.

So the comparison page is a synopsis: one row per matched pasal, old version left, new right,
ayat aligned within the row, deletions marked on the left and insertions on the right. A new
pasal has an empty left side, a removed one an empty right side. BAB dividers follow the new
version. On phones it becomes one inline column (deletions and insertions in place), as most
diff tools do.

Matching stays ours (pasal by content similarity, then ayat, then words with diff-match-patch).
Checked and rejected: `xmldiff` (tree edit scripts with move detection) produced 4,343
low-level edits on the Perampasan Aset drafts and no pasal-to-pasal correspondence, which is
what a synopsis needs. More versions (one column per stage, like the EU four-column format)
can be added later on the same structure.

Addendum (same day): rows pair pasal one-to-one, so a pasal split into two (old Pasal 23 →
new 23 and 24) leaves some ayat without a partner. Those ayat now carry a pointer to their
clearest counterpart elsewhere ("≈ Pasal 23 ayat (2) (2026)"), and a reworded ayat is shown
old-left / new-right on one row. Ayat are matched with TF-IDF cosine similarity.
