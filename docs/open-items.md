# Open items

Known gaps and agreed work not done yet. Remove an item when it ships.

## Parser

- Amending laws (Pasal I/II) are not fully parsed. Pasal.id's parser is the one to port (see `docs/ARCHITECTURE.md`, "Reused instead of written").
- A consolidated current text of amended laws needs amending-law parsing first.
- Text versions are dated by tanggal penetapan when the source has no pengundangan date.
- UU 16/2022 and UU 17/2016 keep a worse text because the importer's safety rule compares against wrong stored counts (`docs/parser-review-2026-11.md`, v17). UU 16/2022's stored Penjelasan includes OCR noise from a map in the Lampiran. UU 17/2016's stored text counts a stray "Cukup jelas." block as a third pasal. Proposed: end the Penjelasan at its "TAMBAHAN LEMBARAN NEGARA ... NOMOR" line (the parser does not yet), and a way for a person to accept a checked text.

## Sources

- Decide whether texts first imported from peraturan.go.id switch to BPK's PDFs (`bpk.pasal_count` holds BPK's count for comparison).
- Omnibus amendments (Cipta Kerja) are not linked to the laws they amend, for example PT (UU 40/2007) and Penanaman Modal (UU 25/2007).

## Review by a lawyer

- Sample families: Minerba (UU 4/2009), PT (UU 40/2007), BUMN (UU 19/2003), Penanaman Modal (UU 25/2007).
- BPK's modern spelling in retyped old laws (`docs/sources.md`).
- Era sample check: two UU per decade, rendered PDF pages compared with the parsed text by eye.
