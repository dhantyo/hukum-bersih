# Open items

Known gaps and agreed work not done yet. Remove an item when it ships.

## Parser

- Parser rewrite (`docs/parser-rules.md`, "Design for the rewrite"): the line registry (`pdf/lines.py`) and the structure state machine (`pdf/structure.py`) are done, with v17's output. Next: fix the known gaps G1-G4, G7, G8 and G10, each in the cell `docs/parser-rules.md` names, then the inline references layer.
- Amending laws (Pasal I/II) are not fully parsed. Pasal.id's parser is the one to port (see `docs/ARCHITECTURE.md`, "Reused instead of written").
- A consolidated current text of amended laws needs amending-law parsing first.
- Text versions are dated by tanggal penetapan when the source has no pengundangan date.
- UU 16/2022, UU 17/2016 and UU 7/2021 still keep their older texts (`reparse_error` v16). The importer's safety rule now measures the stored text itself (`measure` in `sources/peraturan_go_id.py`) and `compare_reparse.py` shows all three accepted at v17; a BPK import flags them for redo (their `reparse_error` is from v16) and should replace them. Still missing: a way for a person to accept a checked text the rule refuses.

## Web

- The contents list in the side panel scrolls itself to the pasal being read, which on collection pages pulls it past the version timeline and feels like a jump. Proposed: only scroll when the current entry is out of view, never while the reader is using the panel, and fold the timeline once the reader scrolls into the text.
- Comparing three or more versions: say between the columns what each one is compared with (each column is marked against its neighbour in the order shown, so a reordered column can be compared with a newer version).
- On a law page comparison, the "= tidak berubah" tag on unchanged pasal assumes the first version is the law's own text; check it on amending-law pages such as `/uu/3/2020/?v=…`.
- Collections without a merged text still list only the changed pasal in the comparison, with no unchanged rows.
- A search result for `/uu/1/1974/#pasal-17` lands on Pasal 11–14.
- No-JavaScript search (`/cari/hasil/`) renders on the Worker at about 10 ms of CPU, the free-plan limit. Make the results page lighter; add the edge cache once the site has its own domain (the Cache API does nothing on `*.workers.dev`).
- Performance, next steps (`docs/performance.md`): replace the `<html>`-anchored `:has()` rules that restyle the whole document on every insert (about 0.5 s on UU 11/2020), then stop sending the law text a second time in the hydration data (about half of a law page's compressed HTML; postponed).
- Undecided: whether search keeps the old results or clears them while new ones load; whether the draft synopsis shares the comparer's marks and legend.
- `docs/solid-migration-handover.md` still describes the rewrite as in progress; bring it up to date or retire it.
- Production domain: attach it to the `web` Worker (whether a plain CNAME works for a Worker is not yet known).

## Sources

- Decide whether texts first imported from peraturan.go.id switch to BPK's PDFs (`bpk.pasal_count` holds BPK's count for comparison).
- Omnibus amendments (Cipta Kerja) are not linked to the laws they amend, for example PT (UU 40/2007) and Penanaman Modal (UU 25/2007).

## Review by a lawyer

- Sample families: Minerba (UU 4/2009), PT (UU 40/2007), BUMN (UU 19/2003), Penanaman Modal (UU 25/2007).
- BPK's modern spelling in retyped old laws (`docs/sources.md`).
- Era sample check: two UU per decade, rendered PDF pages compared with the parsed text by eye.
