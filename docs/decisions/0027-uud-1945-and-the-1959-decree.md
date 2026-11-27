# 0027 The UUD 1945 and the 1959 decree are imported

Date: 2026-11-28 · Decided by: the operator; change by Claude

## What

Two new kinds of record, approved by the operator on 2026-11-27 and 2026-11-28:

- **The UUD 1945** from BPK's entry "UUD 1945 dan Amandemen" (`/Details/101646`), as `uud_1945`,
  and its four amendments as their own works, `uud-perubahan_1_1999` to `uud-perubahan_4_2002`,
  read like amending laws. Versions are merged as for amended laws (decision 0010);
  `UUD45_SatuNaskah.pdf`, the MPR's consolidated text, only checks the merged 2002 version.
- **Keppres 150/1959**, the Dekrit Presiden of 5 July 1959, as a one-off record
  `keppres_150_1959` (Keppres are otherwise not imported). Its text gives the date the UUD 1945
  applied again (`forceMod type="reEnactment"`) and the UUDS 1950 ended (`endOfEnactment` on
  `uu_7_1950`), so `uud_1945` gets its in-force periods from data.
- The UUDS 1950 is not imported: its citations link to `uu_7_1950`, which enacts it. The
  Konstitusi RIS 1949 is left out.
- Dates come only from the documents; BPK gives none. When the first period of the UUD 1945
  ended (with the Konstitusi RIS) stays unknown.

## Why

The UUD is cited in 2,046 of 2,076 Mengingat (measured 2026-11-27; the UUDS 1950 in 387 of
them). Without it the most common citation has nothing to link to, and a link "as at the citing
law" needs the UUD's versions.

## What we gave up

- `uud_1945` breaks the `<jenis>_<nomor>_<tahun>` pattern, since a constitution has no number.
- One Keppres among types we do not import.
