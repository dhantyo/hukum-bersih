# Research: MK rulings, relations and references (2026-11-27)

Notes for the next piece of work. Nothing here is built yet.

## Goal

Each law record carries what the site needs to show where the law sits: its relations to other laws, and the Mahkamah Konstitusi (MK) rulings on its provisions. The site only displays the record with generic templates, not text written per law. Akoma Ntoso stays derived from YAML and Bluebell (see `docs/ARCHITECTURE.md`).

## Sources checked

### Lampiran II of UU 12/2011 (the drafting rules)

- The current rules for drafting regulations. UU 15/2019 and UU 13/2022 amended UU 12/2011; UU 13/2022 added the omnibus method.
- Applies to UU, Perpu, PP, Perpres and Perda, and loosely ("mutatis mutandis", item 60) to lower central rules such as Peraturan Menteri.
- Earlier rules: the Lampiran of UU 10/2004 (2004 to 2011), and Keppres 44/1999 before that (unverified). Laws from before about 1999 follow looser habits.
- References (items 271 to 283):
  - "sebagaimana dimaksud dalam Pasal …" for a pasal or huruf; "sebagaimana dimaksud pada ayat …" for an ayat (items 22, 80, 84, 272).
  - Ranges use "sampai dengan" (273); exceptions use "kecuali" (274); a reference never says "Pasal ini" (275).
  - Order: the ayat of the same pasal first, then lower numbers (276).
  - Only to regulations of the same or a higher level (278); avoid forward references (279); never "pasal tersebut di atas" (280).
  - "sesuai dengan ketentuan Peraturan Perundang-undangan" for unnamed rules (281).
- Amending laws: Pasal I names the amended law and lists numbered changes ("diubah sehingga berbunyi sebagai berikut", "disisipkan", "dihapus"); Pasal II covers commencement (item 233 on). `pipeline/src/hukum_rapih/amendments.py` already reads Pasal I.
- Titles: "PERUBAHAN ATAS", "PERUBAHAN KEDUA ATAS" and so on (items 6, 7); "PENCABUTAN" (item 9).
- The existing prototype `pipeline/scripts/refs_prototype.py` reads the reference forms of this Lampiran. Checking it against laws from other eras is still to do.

### datahukum.com

- A static directory of consolidated texts: UU, PP, Perpres, Perma, treaties, some with English translations. It calls itself a compilation, not an official publication. Coverage is incomplete.
- Pages are static HTML with useful `data-` attributes (`data-pasal`, `data-node-type`, `data-mk-cases`). Example: `https://www.datahukum.com/peraturan/UU_13_Tahun_2012.html`.
- MK rulings are stored per pasal as the ruling text (`div.notesMK`). A browser script reads the quoted phrase and strikes it through at the named pasal, ayat and huruf, with the ruling as a tooltip.
- Its ruling text for UU 13/2012 is word for word BPK's (below).
- It shows a "Riwayat" (amending, implementing and revoking regulations) and an implementation map.
- It refuses automated fetches (403); it opens in a normal browser.

### peraturan.bpk.go.id

- The importer already reads it (`sources/peraturan_bpk.py`). Its detail pages give:
  - **Status peraturan** at whole-law level only (diubah dengan, mengubah, mencabut, dicabut dengan), no pasal. Stored in `bpk.status_peraturan`.
  - **Uji materi**: the MK case number, a PDF link and the ruling text (amar). Stored in `uji_materi`.
- Data is entered by hand; `docs/sources.md` lists known retyping errors. Use it as a hint and confirm from the amending law's own Pasal I.
- Example: for UU 4/2009 (Minerba), BPK lists UU 11/2020, Perpu 2/2022 and UU 6/2023 (Cipta Kerja) as amending it. Our `relationships.amended_by` has only UU 3/2020 and UU 2/2025, because relations come from titles and Cipta Kerja does not name Minerba in its title (the known omnibus gap in `docs/open-items.md`).

## MK rulings we already have

173 rulings on 124 of 2,100 law records (`uji_materi[].amar`), imported automatically from BPK. Rough groups (they overlap; one amar often has parts a, b, c):

| Group | Count | Display |
|---|---:|---|
| Quoted phrase (`frasa "…"`, `sepanjang frasa "…"`) | 69 | Strike the phrase at the named pasal, ayat, huruf |
| Whole pasal or ayat, no phrase | 40 | Mark the provision as no longer binding |
| Conditional (`bersyarat`, `sepanjang (tidak) dimaknai …`) | 103 | No deletion; show the required reading as a note |
| No text | 1 | Link to the ruling only |

Hard cases:

- KUHP rulings sit on `uu_1_1946` but target pasal of the KUHP itself.
- Cipta Kerja rulings target "Pasal 28 dalam Pasal 71 angka 2 Lampiran …", a pasal of another law as amended by Cipta Kerja. Needs the relations work.
- A ruling applies only to text versions in force on or after its date.

## Kinds of relation between laws

From Lampiran II, BPK's status labels and datahukum's Riwayat for UU 4/2009. Counts are entries in `bpk.status_peraturan` across our records (2026-11-27).

| Kind | Meaning | BPK label (count) |
|---|---|---|
| Perubahan | Pasal I changes, inserts or deletes pasal | Mengubah / Diubah dengan (680 / 695) |
| Perubahan sebagian | Amends part of a law, often through an omnibus law | Mengubah sebagian / Diubah sebagian dengan (2 / 8) |
| Pencabutan | Revokes the whole law, usually in the Ketentuan Penutup | Mencabut / Dicabut dengan (482 / 459) |
| Pencabutan sebagian | Revokes some pasal only | Mencabut sebagian / Dicabut sebagian dengan (208 / 184) |
| Penggantian | A new law revokes and replaces the old one (datahukum: "Pendahulu") | shown as Mencabut |
| Penetapan Perpu | The DPR approves a Perpu as a UU; a rejected Perpu is revoked | Menetapkan / Ditetapkan dengan (41 / 16) |
| Putusan MK | Strikes or conditions a provision | `uji_materi` |
| Dasar hukum | The "Mengingat" section names the laws this one rests on | none |
| Delegasi | "diatur dengan Peraturan Pemerintah" in a pasal, and the PP that carries it out | none |

Datahukum's Riwayat for UU 4/2009 lists, per amending law, the pasal it changed, added and revoked. It names four amending laws (UU 3/2020, UU 6/2023, UU 2/2025, UU 1/2026) but skips UU 11/2020 and Perpu 2/2022, although UU 2/2025 calls itself the fourth amendment. UU 6/2023 and UU 1/2026 are omnibus laws whose titles do not name UU 4/2009.

## Relations from the text (measured 2026-11-27)

`relations.py` reads relations from titles only; `amendments.py` reads Pasal I and stores the pasal changed (`amends[].changes`) when a title names one amended law. Against BPK's status lists:

| Kind | BPK | Ours | Both |
|---|---:|---:|---:|
| Mengubah | 674 | 119 | 88 |
| Mencabut | 451 | 7 | 3 |
| Menetapkan | 16 | 80 | 9 |
| Mencabut / Mengubah sebagian | 210 | 0 | 0 |

Causes: revocations are written in the Ketentuan Penutup, not the title; omnibus laws do not name their targets in the title; short title forms ("PERUBAHAN KEDUA UU 32-2004") escape `CITE`; BPK also lists earlier amendments of the amended law (UU 13/2019 "Mengubah" UU 2/2018).

### Revocations (decided)

A prototype that took every UU or Perppu cited in a sentence with "dicabut", "dinyatakan tidak berlaku" or "tidak berlaku lagi" found 382 whole-law pairs, 172 of them among BPK's 451, plus false hits from Menimbang and Mengingat. It missed lists whose items name the law and whose last line has the verb (UU 30/2004). Some BPK pairs are not in the text at all (UU 18/1997 to UU 21/1948). So the rule works on the structure:

1. Only body pasal, usually the Ketentuan Penutup; not Menimbang, Mengingat or the Penjelasan.
2. One pasal at a time with its list items: when it says "dicabut dan dinyatakan tidak berlaku" (or "ditarik kembali …", Lampiran II item 149), each law it cites as the subject is revoked.
3. "Pasal 5 [ayat (2)] Undang-Undang …" in that place is a partial revocation, with the pasal kept.
4. "masih tetap berlaku sepanjang tidak bertentangan" is not a revocation.
5. The revocation takes effect when the revoking law comes into force.
6. A target we do not hold (Staatsblad, PP, ordonnantie) keeps its citation text, with no id.
7. A pair only BPK lists is reported, never added.

**An amending law lapses with the law it amends.** UU 23/2014 revokes "Undang-Undang Nomor 32 Tahun 2004 … sebagaimana telah diubah beberapa kali terakhir dengan Undang-Undang Nomor 12 Tahun 2008". BPK marks UU 32/2004, UU 12/2008 and UU 8/2005 (not named in the text) as revoked by UU 23/2014, and peraturan.go.id marks all three as no longer in force; datahukum lists only UU 32/2004. Lampiran II does not address it (items 145, 147 and 229 cover naming, lists and revoked laws staying revoked). The content of an amending law lives only in the law it amends, so:

- The named law gets `revoked_by`, read from the text.
- Each amending law whose only content is changes to that law gets a derived status, lapsed with its base law, computed and shown apart from an explicit revocation.
- An omnibus law is not marked; only its changes to the revoked law end.
- A chain BPK marks that we do not derive is reported.

### Omnibus amendments (decided)

An omnibus law gives each target law its own pasal, opened by a lead-in ("Beberapa ketentuan dalam Undang-Undang Nomor 26 Tahun 2007 tentang … diubah sebagai berikut:") and followed by numbered instructions, as in Pasal I. A prototype that read these lead-ins found:

| Law | Targets found | Also in BPK | BPK's total | Ours now |
|---|---:|---:|---:|---:|
| UU 6/2023 Cipta Kerja | 69 | 69 | 87 | 0 |
| Perppu 2/2022 Cipta Kerja | 69 | 68 | 81 | 0 |
| UU 11/2020 Cipta Kerja | 66 | 66 | 82 | 0 |
| UU 4/2023 P2SK | 13 | 13 | 22 | 0 |
| UU 7/2021 HPP | 4 | 4 | 10 | 0 |
| UU 1/2026 Penyesuaian Pidana | 2 | 2 | 8 | 0 |

It also flagged UU 13/2022, an ordinary amendment, so detection needs care. BPK's extra targets are mostly the last amender of a chain ("UU 6/1983 … sebagaimana telah beberapa kali diubah terakhir dengan UU 7/2021"), and a few are not in the text at all (UU 6/2023 to UU 2/2015, UU 4/2023 to UU 3/2004).

1. A body with lead-ins naming two or more different laws is an omnibus law. Each lead-in opens a block of instructions up to the next lead-in, and each block goes through `amendments.py` for its own target.
2. In a chain, the target is the base law, not its last amender.
3. UU 1/2026 adjusts penalties in tables in its Lampiran I (7,309 lines), not through lead-ins; those targets are reported until tables are parsed.
4. Cipta Kerja: UU 11/2020 and Perppu 2/2022 amend each target, since both hold the instructions. UU 6/2023 enacts the Perppu (`enacts`; its Lampiran is the Perppu, parsed as a law) and is not counted again. Perppu 2/2022 revokes UU 11/2020 under the revocation rule.
5. Short title forms ("PERUBAHAN KEDUA UU 32-2004") are added to `CITE`.

## Mengingat and inline references (decided 2026-11-27)

Of 2,076 texts, 2,066 have a Mengingat the prototype found. It cites a constitution in 2,046 (the UUD 1945 in 1,654, the UUDS 1950 in 387), a UU or Perppu in 1,077, a TAP MPR in 212, colonial rules (Staatsblad, ordonnantie) in 150 and a PP in 32. Inline references change form by era: before about 1970 laws mostly write "tersebut / termaksud / jang dimaksud dalam pasal / ajat" (about 2,900 hits in the 1940s to 1960s against about 1,270 "dimaksud dalam/pada"); from the 1990s "dimaksud dalam/pada" dominates (about 57,000 hits). The plan in `docs/parser-rules.md` ("Inline references") and `pipeline/scripts/refs_prototype.py` (lark, run at anchors) is the base.

- **All forms are read**: the citation phrase at each anchor ("Pasal 4 ayat (2)", "Undang-Undang Nomor …"), whatever the lead-in, modern, old or bare ("berdasarkan Pasal 5"), with old spellings (ajat, fatsal) recognised. The text is never changed.
- **Links are computed at export**, like the Penjelasan links, and written into the export and the AKN (`ref`, `TLCReference`). Bluebell in `data/` stays as printed.
- **Mengingat** gives each law its legal basis (with the pasal cited) and, reversed, the laws resting on it. A citation of something we do not hold keeps its text with no link.
- **A link to another law's pasal opens the version in force on the citing law's date**; the page can still offer the current one.
- **The UUD 1945 is added** so the most common citation links (approved 2026-11-27 as a new type; needs a decision record and an entry in `docs/NAMING.md` and `docs/sources.md`):
  - Source: BPK's entry "UUD 1945 dan Amandemen" (`/Details/101646`) with six PDFs: `UUD45.pdf`, `UUD45_perubahan1.pdf` to `UUD45_perubahan4.pdf` and `UUD45_SatuNaskah.pdf`. BPK gives no dates ("Tidak ada").
  - Ids: `uud_1945` for the constitution (an exception to `<jenis>_<nomor>_<tahun>`, since it has no number), and each amendment as its own work, `uud-perubahan_1_1999` to `uud-perubahan_4_2002`, read like amending laws.
  - Versions are built from the 1945 text and the four amendments with the same merge as amended laws (decision 0010). `UUD45_SatuNaskah.pdf`, the MPR's consolidated text, only checks that the merged 2002 version comes out right.
  - Dates come from the documents themselves; one that is not printed stays unknown (the bare year), never filled in from memory.
  - **Keppres 150/1959 (the Dekrit Presiden of 5 July 1959) is imported as a one-off record**, `keppres_150_1959` (approved 2026-11-28 as an exception: Keppres are otherwise not imported). Its own text gives the date the UUD 1945 applied again and the UUDS 1950 ended. Two new relation kinds carry that: it reinstates `uud_1945` and ends the UUDS (`uu_7_1950`). `uud_1945` then gets its in-force periods (`temporalData`) from data. When the first period ended (1949 or 1950, with the Konstitusi RIS, which we do not hold) stays unknown rather than guessed.
  - The UUDS 1950 is not imported: its citations (387 laws) link to `uu_7_1950`, which enacts it. Its pasal sit flat inside that law's Pasal I until amending laws are parsed (gap J); then pasal-level links work.
  - The Konstitusi RIS 1949 is not cited in any Mengingat the prototype found, so it is left out.

## Delegation (decided 2026-11-28)

A law often leaves details to a lower regulation: "Ketentuan lebih lanjut mengenai … diatur dengan Peraturan Pemerintah". In our texts 1,172 laws do this, 651 of them to a PP. By the regulation named: PP 4,431, Undang-Undang 1,613, Peraturan Menteri 1,464, Perpres 465, Keppres 307, Peraturan OJK 277, Perda about 344, Peraturan BI 83, others about 150.

- **Now:** each delegating pasal records what it delegates (the subject) and to which kind of regulation. The site can show it as a note on the pasal.
- **Phase 2:** linking a delegation to the regulation that carries it out needs PP and Perpres, which we do not import yet (`docs/BRIEF.md`, phase 2; their number and hosting are in decision 0002). A PP's Mengingat cites the delegating pasal, so the match is precise once they are imported.
- The site never says that no implementing regulation exists, since we cannot know that without them. Delegations to another Undang-Undang are reported, not linked.

## AKN elements for MK rulings and the 1959 decree (decided 2026-11-28)

AKN 3.0 has four kinds of modification under `passiveModifications` (read from the OASIS XSD): `textualMod` (repeal, substitution, insertion, replacement, renumbering, split, join), `meaningMod` (variation, termModification, authenticInterpretation), `forceMod` (entryIntoForce, endOfEnactment, postponementOfEntryIntoForce, prorogationOfForce, reEnactment, unconstitutionality) and `efficacyMod`. Each has a `source`, a `destination` and an optional `condition`. An MK ruling never changes the printed text, so none of its parts is a `textualMod`:

| Ruling or event | Element |
|---|---|
| A provision is no longer binding | `forceMod type="unconstitutionality"`, destination the provision's eId |
| A phrase is no longer binding | the same, destination a span the export puts around the phrase |
| A conditional reading ("sepanjang (tidak) dimaknai …") | `meaningMod type="variation"`, with the reading in a note |
| A rewrite ("menjadi …") | `meaningMod type="variation"`, with MK's wording in a note (this replaces the `textualMod` first listed for item 11) |
| Keppres 150/1959 brings back the UUD 1945 | `forceMod type="reEnactment"` on `uud_1945` |
| … and ends the UUDS 1950 | `forceMod type="endOfEnactment"` on `uu_7_1950` |

Where exactly the reading's note sits is checked against the XSD when built; CI's schema test catches a wrong guess.

## AKN download (open, left for later on 2026-11-28)

How a reader gets a law's AKN file is not decided. Options found: the pipeline writes one AKN file per law version to R2 (a stable path outside the pruned release folders, only changed files uploaded), the Worker converts on request, or the browser converts. Bluebell has a WebAssembly build (`@lawsafrica/bluebell-wasm`, `crates/bluebell-wasm` in laws-africa/bluebell), so text conversion outside Python is possible, but the metadata the pipeline adds (lifecycle, relations, MK rulings, Penjelasan links, references) would have to be rewritten in JavaScript for the last two. The Bluebell texts total 75 MB (largest 1.5 MB, UU 6/2023; measured 2026-11-28).

## Akoma Ntoso feature list (draft, still under discussion)

`akn/build.py` writes the body and the FRBR identity; `akn/meta.py` adds items 1 to 8 below (CI checks them against the AKN 3.0 XSD). The site keeps reading YAML and Bluebell; the AKN file is an export.

From fields the records already have:

1. `lifecycle`: enacted, promulgated, in force (`tanggal_penetapan`, `tanggal_pengundangan`, `tanggal_berlaku`).
2. `temporalData`: when each version was in force (`versions`, `history`).
3. `publication`: the Lembaran Negara (`lembaran_negara`).
4. TLC entries for the signer, place and initiator (`pejabat_penetapan`, `tempat_penetapan`, `pemrakarsa`).
5. `FRBRalias`: the short name (`data/koleksi/`).
6. `classification`: the subject (`subjek`).
7. `proprietary`: source and provenance (`source_url`, `bpk`, `pdf_sha256`).
8. Whole-law relations with their kind from the table above (`relationships`), in `activeModifications` / `passiveModifications`.

Each needs a parser first:

| # | Feature | Waits on |
|---|---|---|
| 9 | MK ruling strikes a phrase or provision (`forceMod type="unconstitutionality"`, source the ruling) | MK amar parser |
| 10 | MK conditional reading (`meaningMod type="variation"`) | MK amar parser |
| 11 | MK "menjadi" rewrite (`meaningMod type="variation"`) | MK amar parser |
| 12 | Pasal-level and Lampiran changes from the amending law | Pasal I parser (`amendments.py`) |
| 13 | Mengingat: the laws this one rests on, and the reverse | Mengingat parser |
| 14 | Inline references ("dimaksud dalam/pada", "tercantum dalam Lampiran"), as `ref` and `TLCReference` | `refs_prototype.py`, checked across eras |
| 15 | Delegation: the pasal that delegates, and (phase 2, once PP and Perpres are imported) the regulation that carries it out | 13 and 14 |

Out for now: implementing rules kept in force by transitional clauses.

## Laws with several BPK files (decided 2026-11-27, not built)

Today the importer reads the first file whose name lacks "penjelasan", plus the files whose name has it, and skips the rest (`sources/peraturan_bpk.py`, `is_penjelasan`). Of 97 records with several files, 106 files are archived but never read: lampiran parts (UU 60/2024, UU 17/2025), treaty texts, a body split in two (UU 7/2017), Penjelasan files named `_pjl` or `_Penj` (UU 23/2019, UU 24/2019), and copies of the same law. UU 23/1968 has no text because BPK lists its lampiran first.

Files get no role. All files of a law are joined in order and the parser finds the Penjelasan and Lampiran in the text, as it does within one PDF.

1. Import (Actions): a record with several files is flagged as needing an order, and the first and last page of each file are written to a queue in the repo.
2. A scheduled cloud routine on Sonnet (the same one that picks Lampiran pictures, below) reads the queue and writes the order, the files to skip as duplicates (the agent chooses which copy to keep) and a one-line reason to an orders file, then opens a PR. No API key; it runs on the subscription.
3. CI checks the orders file: each file once, ids exist.
4. After merge (Actions): the order is written onto the record with `save_record`, the files are joined and parsed. The joined text must open with the front matter and its pasal must run on across each joint; otherwise the record is flagged and the stored text stays.

The record stores only the order, the skipped files and the reason.

## Pinned for discussion


## MK amar parser (decided 2026-11-27)

A rough split of the 173 amar into parts (by "1)", "2.", "a." before a target word) gave 140 with one part, 25 with two and 7 with three or more. By kind, roughly: conditional only 65, conditional with a phrase 34, phrase 31, provision 29, other 17, plus rewrites ("menjadi", about 10), Penjelasan targets (about 18), Lampiran or omnibus-nested targets (about 11) and whole-law rulings (about 9). Things the parser must handle:

- Procedural points of the amar ("Mengabulkan permohonan para Pemohon untuk sebagian", the order to publish in the Berita Negara) are skipped.
- One part can name several targets ("Pasal 10 ayat (2) dan Pasal 11 ayat (1)", "huruf a dan huruf b").
- A target may be a pasal an amending law inserted (UU 3/2020 Pasal 169A), which lives in the merged text of the amended law (UU 4/2009).
- A whole-law ruling (UU 4/2016, UU 7/2004) may also say that an older law applies again.
- A conditional ruling may give no reading (UU 30/2009), and a reading may contain its own a./b./c. list.
- KUHP rulings sit on `uu_1_1946`; Cipta Kerja rulings target "Pasal 28 dalam Pasal 71 angka 2 …".

Proposed shape, on each `uji_materi` entry: `parts`, each with `kind` (phrase, provision, conditional, rewrite, whole_law), `targets` (law, pasal, ayat, huruf, angka, Penjelasan or Lampiran, and the omnibus pasal it sits in), `phrase`, `reading` (the conditional wording) and `new_text` (a rewrite), plus the ruling's `date`. Written by an idempotent pipeline step, never by hand.

- **Clean** means the pattern matched and every target exists in our stored text, with a struck phrase found word for word at that place. Only clean parts change what the site shows.
- **Unparsed rulings** go to the Sonnet routine's queue. It reads the amar in the MK ruling PDF (the authority, not BPK's retyped text) and writes the parts in a PR. Until then the site shows the amar as a note with a link.
- **Date** comes from the ruling PDF ("diucapkan dalam sidang pleno … pada hari …, tanggal …"), by the parser or the routine. No date found means none is shown. A ruling marks only text versions in force on or after that date.
- **Rewrites** keep the printed text, mark it as changed by MK, and show MK's wording under it with the ruling link.
- Display otherwise as above: strike a phrase, mark a provision as no longer binding, show a conditional reading as a note.

## Parser reliability (measured 2026-11-27)

The parser is at v18 (`PARSER_VERSION` in `pdf/structure.py`; the state-machine rewrite, PRs #42 to #46). Most stored texts are older output: v12 1,306, v16 323, v13 216, v17 167, v11 26, none recorded 38. A text is redone only below `PARSER_REDO_BELOW` / `OCR_REDO_BELOW` or when flagged, so later fixes have not reached most texts.

| Across 2,100 records | Count |
|---|---:|
| No text | 24 |
| `pdf_quality: image_only_or_unparsed` | 16 |
| `reparse_error` / `recheck` | 38 |
| Text read by OCR | 332 |
| Amending laws with Pasal I/II only (gap J) | 285 |
| Pasal numbers missing from the sequence | 54 |
| A pasal number twice / out of order | 8 / 5 |

Checks today: the regression set (`tests/regression.yaml`, about 20 laws, `scripts/regress.py`), the stored-text guard (`WORDS_KEPT`), and `scripts/check_texts.py` (valid AKN, pasal without gaps, no page furniture, closing date, Penjelasan pasal against the body; `--flag` writes `recheck`). No workflow runs `check_texts.py`, and nothing measures how much of the PDF's text reaches the output.

### Decided

- **Self-checks run inside the pipeline**, as the last step of every parse (import and reparse), not as a separate script run by hand. `check_texts.py` stays as a way to run them over stored texts.
- **Self-checks build on `check_texts.py`.** Added: word coverage (the share of the PDF's words in the output, measured at parse time since it needs the PDF), the OCR unknown-word rate, ayat and list order, and checks for the Lampiran, tables and Penjelasan links decided above.
- **Results live on the record.** Each text version keeps its numbers and the checks it fails, so a PR's diff shows quality moving; a report lists the worst laws first.
- **Gate.** A new parse replaces a stored text only when it fails no check the stored text passes, on top of the current guard. Otherwise the old text stays and the record is flagged.
- **The site shows a quiet notice** on a law whose text fails checks (for example "Teks ini mungkin belum rapi"), with a link to the official PDF. One template for all laws.
- **Parser PRs** reparse the regression set and a fixed stratified sample (about 100 laws by decade, PDF kind and law kind) on Actions and post each check's count before and after. The whole corpus is reparsed on a schedule.

## Lampiran (measured 2026-11-27)

A Lampiran is stored as flat lines (rule S23 in `docs/parser-rules.md`; `akn/bluebell.py` writes one `PART` per Lampiran, each printed line a paragraph). 135 Lampiran on 98 laws. Rough kinds, from line counts and headings:

| Kind | Laws | Examples |
|---|---:|---|
| A whole law (an enacted Perppu) | about 16 | UU 6/2023 (2,859 pasal lines), UU 2/2020, UU 1/2015 |
| Budget tables | about 14 | UU 62/2024, UU 12/2016 |
| Other tables and lists | about 12 | UU 7/2023 (KPU seats), UU 35/2009, UU 1/2026 |
| Maps; only the legend text survives | about 30 | UU 9/2001 to UU 8/2003, UU 14/2022, UU 21/2023 |
| Treaty texts, mostly a cover page only | about 11 | UU 5/2009, UU 10/2014 |
| Long prose with numbered items | about 5 | UU 12/2011, UU 13/2022, UU 59/2024 |
| Parse errors | about 6 | bug G2 in UU 12/2011 and UU 13/2022 |

### Decided

- **A whole law is parsed as a law**: BAB, pasal, ayat and its own Penjelasan, inside the attachment, so MK rulings and omnibus changes can target its pasal.
- **Tables are detected from the PDF layout** with PyMuPDF's `find_tables` (already a dependency), and stored as rows and cells (Bluebell and AKN tables). Scanned pages are OCR'd first, on Actions. Tables it cannot read are reported, not guessed.
  - AKN 3.0 (the OASIS XSD that `pipeline/scripts/validate_akn.py` pins): `table` holds an optional `caption` (one line of inline text) and `tr` rows of `th` and `td` cells; a cell has `rowspan` and `colspan` and holds blocks (paragraphs, lists, a nested table). There is no `thead`, `tbody` or `tfoot`, no column type and no unit, so an amount is plain text and "(Ribu Rupiah)" is a paragraph or the caption.
  - Bluebell writes it as `TABLE`, `TR`, `TH{colspan 2}`, `TC` (laws-africa/bluebell `docs/grammar.md`). `find_tables` gives rows, cells and spans, which map onto these directly.
  - A table that runs over several pages is joined into one, and the header row repeated on each page is dropped.
- **Pictures are kept as images**: maps and any other picture in a Lampiran. A new kind of data, so it needs a decision record first.
  1. The parser flags each Lampiran page that holds a picture or drawing and puts a preview of it in the queue.
  2. The same Sonnet routine that orders files looks at each flagged page and decides whether it is a picture worth keeping and what area to cut, then opens a PR with its choices.
  3. After merge, Actions cuts each image as WebP at about 200 dpi, stores it in R2 (not git, outside the pruned release folders) and the parser places it in the Lampiran at its page. The text around it, such as a map's legend, stays as text.
  - Licence: UU 28/2014 Pasal 42 huruf b says there is no copyright on peraturan perundang-undangan, so the images fit `data/`'s CC0.
  - Bluebell has an image element: `{{IMG src description}}` (inline, `docs/grammar.md` in laws-africa/bluebell), written to AKN as `img`. It also has `TABLE` for the tables above.
  - R2 free tier (developers.cloudflare.com/r2/pricing, read 2026-11-27): 10 GB-month of storage, 1 million Class A and 10 million Class B operations a month, egress free. How much the releases already use is not checked.
  - Previews reach the routine through a git branch, not R2. A cloud session clones its repository through GitHub, which the default **Limited** network level allows; R2 would need a public URL and that host added to the environment's allowed domains (code.claude.com/docs/en/cloud-environments). Actions commits the queue (page excerpts and preview images) to a queue branch; the routine's PR to `main` carries only its choices, so no image enters `main`. Previews are PNG or JPEG, which Claude reads as images.
- **Prose Lampiran and treaty texts**: printed lines are joined into paragraphs, and BAB, "A." and "1." headings and numbered items are read, with the Penjelasan list rule. Treaties get this treatment, not law structure.
- Bugs G1 and G2 (`docs/parser-rules.md`) are fixed as bugs.
- **Nested Lampiran.** A law printed in a Lampiran keeps its own Lampiran under it. UU 7/2023 stores the Perppu as one Lampiran and then Lampiran I to IV (KPU seat tables), which by their titles belong to the Perppu. Unclear cases are reported.
- **Links to a Lampiran.** "sebagaimana tercantum dalam Lampiran I …" in the body is part of the inline references (feature 14) and links to that Lampiran.
- **Amended Lampiran.** Pasal-level changes (feature 12) take a Lampiran as a target too ("Lampiran … diubah"). The "Semula / Menjadi" tables of APBN-P laws stay ordinary tables.
- **Size on the site.** A law page loads a Lampiran only when the reader opens it (UU 6/2023 has 36,560 Lampiran lines; UU 60/2024 will have about 2,350 pages). Site work, later.
- **Search.** Prose Lampiran are indexed; table cells are not.

## Penjelasan (measured 2026-11-27)

`akn/bluebell.py` (`_penjelasan`) writes the Penjelasan as an attachment: Umum, Pasal demi Pasal, one `ART` per pasal and nested `PARA` labels (Ayat > Huruf > Angka). Of 2,076 texts, 1,696 have a Penjelasan. Recent laws come out clean. Weak spots:

| Finding | Laws |
|---|---:|
| Neither Umum nor Pasal demi Pasal found | 221 |
| No pasal in the Penjelasan although the law has pasal | 254 |
| A paragraph over 3,000 characters | 302 |
| An "a. … b. …" list inside one paragraph | 491 |

- Old Penjelasan are one block (gap G8; UU 13/1952), with "Memori Penjelasan", "Fatsal" and a numbered Umum.
- An amending law's Penjelasan without a "Pasal I" heading loses its labels, since labels count only under a pasal (S33; UU 13/1997).
- Missing Penjelasan: 63 of 107 texts from the 1940s and 226 of 444 from the 1950s (often none was printed), but also 39 from 2000 on, some in files the importer skips (UU 23/2019, UU 24/2019).

### Decided

- **Link to the body, down to ayat and huruf.** The pipeline works the link out at export and writes it into the export and the AKN (a `ref` to the body element's eId); it is not stored in Bluebell. Penjelasan Pasal 5 Ayat (2) Huruf b links to Pasal 5 ayat (2) huruf b, or to the nearest level above that exists. In an amending law, Pasal I Angka 3 links to item 3 of the body's Pasal I. Entries with no match are listed in a report, never guessed. The site follows the link instead of matching numbers itself (today `placeExplanations` and `data-pj-for` in `web/src/components/law-text.tsx`, pasal level only).
- **"Cukup jelas" as a flag.** The pipeline flags each entry (pasal, ayat, huruf) whose whole text is such a phrase; the site hides by the flag instead of its regex (`CUKUP_JELAS` in `web/src/lib/display.ts`, exact "cukup jelas" only). The phrases are a data list: cukup jelas, sudah jelas, tidak memerlukan penjelasan (lebih lanjut), cukup terang, with an optional final dot or comma. The text is never changed. Entries that start with a phrase but say more are reported.

Counts behind the flag: "Cukup jelas" 62,895 entries and other casing about 280, which the site catches; it misses "Tidak memerlukan penjelasan" (about 100), "Sudah jelas" (23), "Cukup jelas," (11), "Cukup terang" (4), and about 290 entries where labels or junk are glued on ("Cukup jelas. (2)Cukup jelas", "Ayat (2a)", "Huruf 1", `www.djpp…` footers, "Mengetahui").

- **Labels and junk.** Read "(2)", "Ayat (2a)" and "Huruf 1" as labels, and drop website footers, so glued entries split.
- **Lists, strict rule.** Split an "a. … b. …" run into items only after a colon and with the letters in order. The same rule serves prose Lampiran.
- **Implicit Pasal I.** In an amending law's Pasal demi Pasal, "Angka 1" with no pasal open belongs to Pasal I, so its labels and links work.
- **Old laws, basic structure.** Read "Fatsal" as a pasal and "Memori Penjelasan" as the heading, and split at the PDF's paragraph breaks; nothing deeper. Links then work at pasal level.
- **Missing Penjelasan.** Count again once all files of a law are joined, then look only at those still missing.

## Proposed order

Superseded on 2026-11-28 by the build order below; the decisions are 0021 to 0028.

## Build order (2026-11-28)

Each step is one or more PRs that end in a check. Steps marked "any time" depend on nothing before them.

1. **Self-checks in the pipeline** (decision 0026): extend `check_texts.py`, results on the record, the gate, the PR sample. Everything after is measured with it.
2. **Reparse the corpus with the current parser** on Actions, under the gate. Most texts are v12 output.
3. **The agent routine and joined files** (decisions 0022, 0023): the queue branch, the orders file and its CI check, the Sonnet routine, then joining and the joint checks.
4. **Structure**: amending laws' quoted pasal (gap J); a law inside a Lampiran parsed as a law, nested Lampiran, prose Lampiran, bugs G1 and G2; the Penjelasan fixes (labels, lists, implicit Pasal I, old laws). Then tables (`find_tables`) and pictures (decision 0024).
5. **Relations** (decision 0025): revocations, the lapsed status, omnibus blocks (needs step 4 for UU 6/2023), short title forms.
6. **MK rulings** (decision 0028): the parser and its clean count (needs step 4 so targets exist), dates from the ruling PDFs, unparsed rulings to the routine.
7. **Mengingat and references**, then **delegation clauses**.
8. **Export and AKN** (decision 0021): Penjelasan links and the "cukup jelas" flag, reference links, items 9 to 15 of the feature list.
9. **Site**: follow the links and flags, the quiet notice, MK display, Lampiran loaded on opening.

Any time: **AKN from existing fields** (items 1 to 8 of the feature list); **the UUD 1945 and Keppres 150/1959** (decision 0027). Later: the AKN download; PP and Perpres (phase 2) for delegation targets.

Adding fields means changing the schema in `records.py` first (pipeline `AGENTS.md`).
