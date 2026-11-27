# 0025 Relations are read from the law's text; BPK is a hint

Date: 2026-11-28 · Decided by: the operator; change by Claude

## What

Relations between laws come from the laws' own text, not only from their titles. BPK's status
list is used to check what we find; a pair only BPK lists is reported, never added.

- **Revocation.** Read from body pasal (usually the Ketentuan Penutup), one pasal with its list
  items at a time: each law cited as the subject of "dicabut dan dinyatakan tidak berlaku" (or
  "ditarik kembali …") is revoked; "Pasal 5 … Undang-Undang …" there is a partial revocation.
  Menimbang, Mengingat, the Penjelasan and "masih tetap berlaku" are not revocations. It takes
  effect when the revoking law comes into force.
- **Lapsed with the base law.** An amending law whose only content is changes to a revoked law
  gets a derived status, shown apart from an explicit revocation. An omnibus law is not marked;
  only its changes to that law end.
- **Omnibus amendments.** A body with lead-ins naming two or more laws ("Beberapa ketentuan dalam
  Undang-Undang Nomor … diubah") is split into one block of instructions per target, each read
  by `amendments.py`. In a chain ("… sebagaimana telah diubah terakhir dengan …") the target is
  the base law. Cipta Kerja: UU 11/2020 and Perppu 2/2022 amend each target; UU 6/2023 enacts
  the Perppu and is not counted again.
- **Citations we do not hold** (Staatsblad, PP, TAP MPR) keep their text with no id.

## Why

Measured 2026-11-27 against BPK: 7 of BPK's 451 revocations and 119 against BPK's 674
amendments, because revocations and omnibus targets are not in titles. BPK's list is typed by
hand, lists earlier amenders of a chain as amended, and names some pairs the texts never state
(UU 18/1997 to UU 21/1948). The text of the law is what binds.

## What we gave up

- Relations that are only implied (a new law that replaces an old one without saying so) are
  not recorded.
- The derived "lapsed" status is our reading: Lampiran II of UU 12/2011 does not address it,
  while BPK and peraturan.go.id mark the whole chain as no longer in force (UU 23/2014 and UU
  32/2004, 8/2005, 12/2008).
