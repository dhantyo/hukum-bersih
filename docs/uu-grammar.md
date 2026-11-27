# Structure of a UU

The parts of an Undang-Undang (UU) and the lines that start and end each part, as the drafting
standard sets them, followed by what laws in `data/` do differently. This is groundwork for the
parser rewrite. The rules the parser applies today are listed in [parser-rules.md](parser-rules.md).

Sources, read from BPK's PDFs (Hugging Face mirror `Azzindani/ID_REG`, sha256 equal to the
manifest):

- **L12**: UU 12/2011, Lampiran II "Teknik Penyusunan Peraturan Perundang-undangan", items 1-284,
  in force for laws from 12 August 2011.
- **L10**: UU 10/2004, Lampiran, the same chapters with other item numbers, for laws from 2004 to 2011.
- UU 12/2011 Pasal 81-85 (where the Lembaran Negara and its Tambahan come from).

The stored text of UU 12/2011 is incomplete (see [Known gaps](#known-gaps)), so read the PDF,
not `data/peraturan/uu/2011/uu_12_2011/`, when you check an item.

## Outline

```
uu          = judul pembukaan batang_tubuh penutup penjelasan? lampiran*      L12 1, L10 1
pembukaan   = frasa jabatan konsiderans dasar_hukum diktum                     L12 14, L10 13
batang_tubuh= (buku | bab | pasal)+                                            L12 61, 67-70
buku        = "BUKU" ordinal TITLE (bab)+          codes only                  L12 68, 71
bab         = "BAB" roman TITLE (bagian+ | pasal+)                             L12 70, 72
bagian      = "Bagian" ordinal Title (paragraf+ | pasal+)                      L12 70, 73-74
paragraf    = "Paragraf" arabic Title pasal+                                   L12 70, 75-76
pasal       = "Pasal" arabic (ayat+ | content)                                 L12 77-80
ayat        = "(" arabic ")" content                                           L12 81-84
content     = sentence (rincian_1+ wrap?)?                                     L12 85-91
rincian_1   = "a." ... ; rincian_2 = "1." ... ; rincian_3 = "a)" ... ; rincian_4 = "1)" ...
                                                                               L12 92-95, L10 71
penutup     = perintah pengesahan pengundangan ln_line                         L12 160, L10 134
penjelasan  = judul_penjelasan umum pasal_demi_pasal tln_line                  L12 180-182
lampiran    = "LAMPIRAN" roman? judul_lampiran body signature                  L12 192-197
```

Order of the batang tubuh groups (L12 62, L10 43): Ketentuan Umum (always BAB I, or the first
pasal, L12 96), materi pokok, Ketentuan Pidana, Ketentuan Peralihan, Ketentuan Penutup (always
the last BAB or last pasal, L12 136). A BAB holds either pasal directly or Bagian; a Bagian holds
either pasal or Paragraf (L12 70). Bagian and Paragraf never stand outside a BAB.

## Parts

### Judul (title)

| | |
|---|---|
| Start | First line of page 1 after the crest caption: `UNDANG-UNDANG REPUBLIK INDONESIA` |
| Lines | `NOMOR 6 TAHUN 2011` / `TENTANG` / name, all in capitals, centred, no final punctuation (L12 2-4, L10 2-4) |
| End | `DENGAN RAHMAT TUHAN YANG MAHA ESA` |
| Variants | Amending law: name starts `PERUBAHAN ATAS`, `PERUBAHAN KEDUA ATAS` (L12 6-7). Revoking law: `PENCABUTAN` (L12 9). Law enacting a Perppu: `PENETAPAN PERATURAN PEMERINTAH PENGGANTI UNDANG-UNDANG … MENJADI UNDANG-UNDANG` (L12 10, L10 9). Ratification: `PENGESAHAN` (L12 11-13) |

### Pembukaan (enacting formula and preamble)

In this order (L12 14, L10 13):

| Part | Printed as | Item |
|---|---|---|
| Frasa | `DENGAN RAHMAT TUHAN YANG MAHA ESA`, capitals, centred | L12 15 |
| Jabatan | `PRESIDEN REPUBLIK INDONESIA,` capitals, centred, ends in a comma | L12 16 |
| Konsiderans | Starts `Menimbang`; one point per letter `a.`, each `bahwa …;`; the last point of a UU is `bahwa berdasarkan pertimbangan sebagaimana dimaksud dalam huruf a, … perlu membentuk Undang-Undang tentang …;` | L12 17-23, L10 16-21 |
| Dasar hukum | Starts `Mengingat`; numbered `1.`, `2.` … when more than one, each ends in `;` | L12 28, 52; L10 25, 34 |
| Persetujuan | `Dengan Persetujuan Bersama` / `DEWAN PERWAKILAN RAKYAT REPUBLIK INDONESIA` / `dan` / `PRESIDEN REPUBLIK INDONESIA` | L12 55, L10 37 |
| Diktum | `MEMUTUSKAN:` (capitals, no spaces, centred), then `Menetapkan:` + the kind and name again in capitals, ending in a full stop: `Menetapkan: UNDANG-UNDANG TENTANG ….` | L12 53-58, L10 36-40 |

The labels `Menimbang`, `Mengingat` and `Menetapkan` are aligned, so the first point often stands
on the label's line: `Menimbang : a. bahwa …`.

### Batang tubuh (body)

| Unit | Heading | Title | Item |
|---|---|---|---|
| Buku | `BUKU KETIGA` (ordinal in words) | capitals, next line | L12 71 |
| BAB | `BAB I` (Roman) | capitals, next line(s): `KETENTUAN UMUM` | L12 72, L10 53 |
| Bagian | `Bagian Kesatu` (ordinal in words) | each word capitalised: `Susunan dan Kedudukan` | L12 73-74, L10 54-55 |
| Paragraf | `Paragraf 1` (Arabic) | each word capitalised | L12 75-76, L10 56-57 |
| Pasal | `Pasal 3` (Arabic), on its own line | none | L12 79, L10 60 |
| Ayat | `(1)` at the start of a line, no full stop after the bracket | none | L12 82, L10 63 |

Lists inside a pasal or ayat (tabulasi, L12 85-95, L10 66-71), outermost first:

| Level | Marker | Item |
|---|---|---|
| 1 | `a.`, `b.`, … | L12 92 |
| 2 | `1.`, `2.`, … | L12 93 |
| 3 | `a)`, `b)`, … | L12 94 |
| 4 | `1)`, `2)`, … | L12 95 |

Each item but the last ends in `;`, the item before the last adds `dan`, `atau` or `dan/atau`
(L12 88-91). The last item ends in `.` or, when the list goes on in the next level, in `:`.

Numbers in headings follow each other: Pasal n+1 after Pasal n, ayat (k+1) after (k), b after
a. A pasal referred to in text has a capital P too (L12 80: `… dimaksud dalam Pasal 20`), so a
wrapped line can start with `Pasal 20`. Only the sequence tells a heading from a reference.

### Penutup (closing)

In this order (L12 160-173, L10 134-147):

| Part | Printed as | Item |
|---|---|---|
| Perintah pengundangan | `Agar setiap orang mengetahuinya, memerintahkan pengundangan Undang-Undang ini dengan penempatannya dalam Lembaran Negara Republik Indonesia.` | L12 161, L10 135 |
| Pengesahan (right) | `Disahkan di Jakarta` / `pada tanggal …` / `PRESIDEN REPUBLIK INDONESIA,` / signature (`ttd.` in copies) / name in capitals | L12 164-166 |
| Pengundangan (left) | `Diundangkan di Jakarta` / `pada tanggal …` / `MENTERI HUKUM DAN HAK ASASI MANUSIA` / `REPUBLIK INDONESIA,` / `ttd.` / name | L12 167-169 |
| Unsigned law | `Undang-Undang ini dinyatakan sah berdasarkan ketentuan Pasal 20 ayat (5) …` after the minister's name | L12 170 |
| Lembaran Negara | `LEMBARAN NEGARA REPUBLIK INDONESIA TAHUN 2011 NOMOR 82`, capitals | L12 172-173, L10 146-147 |

The LN line ends the law proper. A copy may add the State Secretariat's certification
(`Salinan sesuai dengan aslinya` / office / name), often under a round stamp. It is not part of
the law and is not in L12.

### Penjelasan (explanation)

Every UU has one (L12 174). In the Gazette it is the Tambahan Lembaran Negara (UU 12/2011
Pasal 84(1)), so it is printed after the closing on a new page.

| | |
|---|---|
| Start | `PENJELASAN` / `ATAS` / `UNDANG-UNDANG REPUBLIK INDONESIA` / `NOMOR … TAHUN …` / `TENTANG` / name (L12 180, L10 153) |
| Umum | `I. UMUM`, prose; parts may be numbered `1.`, `2.` … (L12 182, 184; L10 155) |
| Pasal demi pasal | `II. PASAL DEMI PASAL`, then each pasal of the body by its heading, in order, none merged (L12 182, 188) |
| Inside a pasal | `Cukup jelas.` (L12 188-189), or one label per ayat: `Ayat (1)` / `Cukup jelas.` (L12 190). `Huruf a` and `Angka 1` labels for list items are used the same way in our texts; L12 does not name them |
| End | `TAMBAHAN LEMBARAN NEGARA REPUBLIK INDONESIA NOMOR 5234`, the Tambahan's number. L12 does not set this line out; the stored texts show it on 335 of 367 laws of the 2000s and 253 of 254 of the 2020s |

### Lampiran (annex)

| | |
|---|---|
| When | A pasal of the body says the Lampiran is part of the law (L12 192) |
| Content | text, lists, tables, pictures, maps, sketches (L12 193) |
| Start | `LAMPIRAN`, or `LAMPIRAN I`, `LAMPIRAN II` … when there are more (L12 194), followed by the law's title top right in capitals (L12 195) and the Lampiran's name centred in capitals (L12 196) |
| End | `PRESIDEN REPUBLIK INDONESIA,` / signature / name, bottom right (L12 197); the next `LAMPIRAN` heading or the end of the file |

Where it stands: after the Penjelasan in the PDF (UU 12/2011, UU 14/2013), or in a separate PDF
(UU 3/2019). Our Bluebell output puts every Lampiran after the
Penjelasan (`akn/bluebell.py`).

## Special kinds of UU

### Amending law (L12 230-238, L10 195)

The body has two pasal with Roman numbers (L12 233):

- `Pasal I` names the amended law with its LN and TLN in brackets, then the changes, one per
  Arabic number: `1. Ketentuan Pasal 6 diubah sehingga berbunyi sebagai berikut:` followed by the
  new wording of Pasal 6, quoted with its own heading. When the law was amended before, the
  earlier amending laws are listed `a.`, `b.` … before `diubah sebagai berikut:`.
- `Pasal II` holds the commencement (and sometimes transitional rules).

Inserted units take a letter: `BAB IXA`, `Pasal 128A` (L12 234), `(1a)` (L12 235). Deleted
units stay with `dihapus` (L12 236: `(2) Dihapus.`). So inside Pasal I, `BAB`, `Pasal` and
`(1)` lines belong to the amended law and are content, not structure of the amending law.

The Penjelasan follows the same shape: `Pasal I` / `Angka 1` / `Pasal 6` / `Ayat (1)` /
`Cukup jelas.` … / `Pasal II` / `Cukup jelas.`.

### Law enacting a Perppu (L12 239, L10 202)

Two pasal with Arabic numbers: `Pasal 1` enacts the Perppu and attaches it; `Pasal 2` is the
commencement. The Perppu follows as the Lampiran, printed whole: its own title, preamble, body,
closing with its own LN line, Penjelasan and TLN line. Such a PDF has two LN lines and two TLN
lines. A Perppu that amends a law has Pasal I/II inside the Lampiran.

Example: UU 17/2016 (Perppu 1/2016, child protection). PDF pages 1-4: UU 17/2016 with
Pasal 1-2, `LEMBARAN NEGARA … TAHUN 2016 NOMOR 237`; pages 5-6: its Penjelasan, ending
`TAMBAHAN … NOMOR 5946`; page 7: `LAMPIRAN`, then the Perppu with Pasal I (amending UU 23/2002)
and Pasal II, `LEMBARAN NEGARA … TAHUN 2016 NOMOR 99` (page 14), its Penjelasan, ending
`TAMBAHAN … NOMOR 5882` (page 17).

UU 9/2017 (Perppu 1/2017): BPK's PDF has the law and the Perppu as its Lampiran, the Perppu's
`PENJELASAN` / `ATAS` / `PERATURAN PEMERINTAH` / `PENGGANTI UNDANG-UNDANG …` included; the law's
own Penjelasan is a separate PDF, read after the Lampiran. Only the heading that names the law
itself (`UNDANG-UNDANG … NOMOR 9 TAHUN 2017`) is the law's Penjelasan (S23).

### Ratification law (L12 240-241)

Two pasal with Arabic numbers: `Pasal 1` ratifies and attaches the treaty, `Pasal 2` the
commencement. The treaty text is the Lampiran (L12 240).

## Citation forms

How a law refers to another law and to its own units. L12 sets the forms in Dasar Hukum
(items 44-52), Pencabutan (144-149), Perubahan (233) and Teknik Pengacuan (271-283). These
are the targets of a later inline-reference layer (Bluebell `{{>href text}}`, Akoma Ntoso `<ref>`).

### To a law

| Form | Where | Item |
|---|---|---|
| `Undang-Undang Nomor 6 Tahun 2011 tentang Keimigrasian (Lembaran Negara Republik Indonesia Tahun 2011 Nomor 52, Tambahan Lembaran Negara Republik Indonesia Nomor 5216)` | Mengingat, Pencabutan, Pasal I, Ketentuan Penutup: kind with a capital, no "Republik Indonesia", LN and TLN in brackets | L12 45-47, 146, 233 |
| `Pasal 5 ayat (1) dan Pasal 20 Undang-Undang Dasar Negara Republik Indonesia Tahun 1945` | Mengingat: the constitution is the only law cited with its pasal | L12 44 |
| `Kitab Undang-Undang Hukum Dagang (Wetboek van Koophandel, Staatsblad 1847: 23)` | Colonial law: Indonesian name, Dutch name, Staatsblad year and number | L12 50 |
| `Undang-Undang Nomor … Tahun … tentang … (…) yang telah beberapa kali diubah dengan Undang-Undang: a. Nomor … Tahun … (…); b. …` | Pasal I of an amending law: earlier amendments listed by letter | L12 233 b |
| `Undang-Undang Nomor … sebagaimana telah diubah dengan Undang-Undang Nomor …` | Mengingat and body of laws citing an amended law | not in L12; used in 54 of the 254 stored UU of the 2020s |
| `Peraturan Pemerintah Nomor … Tahun … tentang …`, `Peraturan Presiden …` | Delegation and Ketentuan Penutup | L12 46, 283 |
| `Undang-Undang ini`, `Peraturan Pemerintah ini` | the law itself | L12 150, 282 |
| In titles, capitals: `PERUBAHAN ATAS UNDANG-UNDANG NOMOR 4 TAHUN 2009`, `PENETAPAN PERATURAN PEMERINTAH PENGGANTI UNDANG-UNDANG NOMOR 1 TAHUN 2016 … MENJADI UNDANG-UNDANG` | Judul | L12 6-10 |

Older laws: `Undang-undang No. 10 Prp tahun 1960`, `Undang-Undang Darurat No. 3 Tahun 1953`,
`Undang-Undang Nomor 7 Drt Tahun 1956`, `(Lembaran-Negara Tahun 1963 No. 63)`.

### To a unit (pasal, ayat, huruf, angka)

| Form | Meaning | Item |
|---|---|---|
| `sebagaimana dimaksud dalam Pasal 71` | a pasal of this law ("dalam" before Pasal) | L12 272 |
| `sebagaimana dimaksud pada ayat (1)` | an ayat of the same pasal ("pada" before ayat; never "ayat (1) Pasal ini") | L12 272, 275 |
| `Pasal 4 ayat (2) huruf a` | nested: pasal, ayat, huruf (then `angka 1`) | L12 272 |
| `Pasal 5 sampai dengan Pasal 9`, `ayat (1) sampai dengan ayat (4)`, `huruf a sampai dengan huruf e` | range | L12 273 |
| `Pasal 5 sampai dengan Pasal 12 …, kecuali Pasal 7 ayat (1)` | range with an exception | L12 274 |
| `ayat (1), Pasal 7 ayat (2) dan ayat (4), Pasal 12, dan Pasal 13 ayat (3)` | list: own ayat first, then lower numbers; `ayat (4)` belongs to Pasal 7 | L12 276 |
| `Pasal 37 ayat (4)` | a later pasal (to be avoided, but used) | L12 279 |
| `Pasal 15 Undang-Undang Nomor …` | a unit of another law: the law follows the unit | L12 44, 283 |

Capitals: `Pasal` with a capital when cited (L12 80), `ayat` in lower case (L12 84). A cited
`Pasal 20` can therefore start a wrapped line and look like a heading; only the heading sequence
tells them apart (see [Batang tubuh](#batang-tubuh-body)).

Where mentions occur: Konsiderans (`bahwa … Pasal 18 …`), Mengingat (one law per item), body
text, the Penjelasan (`Ayat (1)` labels are headings there, not references), the closing
(`Lembaran Negara …`, not a link target) and the quoted wording inside an amending law's Pasal I,
where `Pasal 6` refers to the amended law, not to the amending one.

## Exceptions in our data

### Laws before 2004

UU 10/2004 is the first law that sets the drafting standard; guidance before it was not checked.
Feature counts over the stored texts in `data/peraturan/uu/`, one text per law, measured
2026-11-24 with `uv run python scripts/uu_features.py` in `pipeline/`. "Umum" means that the
parser found a Penjelasan Umum section.

| Decade | UU | With Penjelasan | With Umum section | With TLN line | `Dengan Persetujuan Bersama` | With a `Pasal I` |
|---|---:|---:|---:|---:|---:|---:|
| 1940s | 106 | 43 | 11 | 0 | 0 | 0 |
| 1950s | 415 | 190 | 60 | 112 | 1 | 115 |
| 1960s | 187 | 163 | 128 | 96 | 1 | 3 |
| 1970s | 82 | 82 | 69 | 28 | 0 | 7 |
| 1980s | 101 | 94 | 93 | 43 | 0 | 7 |
| 1990s | 185 | 181 | 179 | 111 | 0 | 21 |
| 2000s | 367 | 339 | 328 | 335 | 300 | 52 |
| 2010s | 216 | 210 | 208 | 201 | 216 | 32 |
| 2020s | 254 | 253 | 249 | 253 | 253 | 25 |

What differs, with an example each:

| Feature | Before | Example |
|---|---|---|
| Spelling | Ejaan Lama in scans and in peraturan.go.id's copies: `Djakarta`, `jang`, `PENDJELASAN`, `Disjahkan`. BPK's retyped copies mostly use modern spelling | UU 1/1945 (`Djakarta, tanggal 23 Nopember 1945,`) |
| Headings | End in a full stop: `Pasal 1.`, `BAB I.`, `BAGIAN II.`; Bagian with Roman numbers; `Bab Pertama` | UU 25/1956, UU 6/1964 |
| Chapter titles | In normal capitals over several lines: `Tentang Urusan Rumah-Tangga` / `dan Kewajiban-Kewajiban Propinsi.` | UU 25/1956 |
| Persetujuan | `Dengan persetujuan Dewan Perwakilan Rakyat` (Gotong Royong in the 1960s); `Dengan Persetujuan Bersama` from 2001 (first in our data), on all but 3 laws from 2005 to 2009 | UU 6/1964 |
| Closing | `Agar supaya setiap orang dapat mengetahuinya, memerintahkan …`; `Ditetapkan di Yogyakarta` (1947); promulgation by `Diumumkan pada tanggal …`; `Djakarta, tanggal …` alone; LN line `LEMBARAN NEGARA NOMOR 65 TAHUN 1956` (number before year) | UU 30/1947, UU 25/1956, UU 1/1945 |
| Penjelasan heading | `MEMORI PENJELASAN`, `PENDJELASAN UNDANG-UNDANG 1945 NO. 1`, `PENJELASAN UMUM` on one line, `A. PENJELASAN UMUM.` / `B. PENJELASAN PASAL DEMI PASAL.` | UU 25/1956, UU 1/1945, UU 6/1967 |
| Penjelasan body | No `I. UMUM` / `II. PASAL DEMI PASAL` split; only some pasal explained (UU 2/1962: Pasal 5, then Pasal 12); `Fatsal pertama.` for Pasal 1 | UU 1/1945, UU 2/1962 |
| TLN line | Absent before 1953 in our data; on 27% of 1950s laws, 91% of the 2000s, all but one of the 2020s | UU 1/1945 has none |
| Amending laws | `Pasal I` with Roman-numbered changes (`XXVI. Pasal 44 akan berbunyi …`) and then the law's own `Pasal 2`, `Pasal 3` in Arabic | UU 2/1953, UU 12/1957 |
| Misprints | Pasal numbers repeated or skipped in the copy: `Pasal 9` twice (UU 19/1948), `Pasal II` for 11 (UU 1/1951), `Pasal I.` for Pasal 1 (UU 16/1953), BAB VII twice (UU 19/1997) | as named |

### Amending laws (2004 on)

Shape as in [Amending law](#amending-law-l12-230-238-l10-195). Examples: UU 14/2013 (Pasal I/II,
Lampiran), UU 18/2025 (third amendment, inserts `BAB IVA`; a scan, OCR reads `Pasal I` as
`Pasal 1`), UU 2/2025 (Penjelasan `Pasal I` / `Angka 1` / `Pasal 1`).

Exception: an amending law may amend several laws with Arabic pasal, one pasal per amended law,
each quoting pasal of the amended law (UU 7/2021: Pasal 2 quotes `Pasal 4`, `Pasal 5` of UU
6/1983). Here only the lead-in `… sehingga berbunyi sebagai berikut:` tells a quoted heading from
the law's own.

### Penjelasan in a separate PDF

BPK publishes some Penjelasan as their own file. UU 19/2003: `undang-undang nomor 19 tahun
2003.pdf` (the body, a web page printed from a browser, with `4/3/24, 9:34 AM …` headers) and
`UU Nomor 19 Tahun 2003_ penjelasan.pdf`. Both are listed under `bpk.files` in the record and
read in that order.

### Lampiran as a separate PDF

UU 3/2019's memorandum is its own file in BPK's listing, archived and listed on the record but
not parsed into the text.

### Copy certification

`Salinan sesuai dengan aslinya` / `KEMENTERIAN SEKRETARIAT NEGARA RI` / deputy / name, after the
LN line or at the end of a Lampiran (UU 14/2013, UU 2/2025). Not part of the law.

## Known gaps

Measured with the current parser (v17) on BPK's PDFs:

- Closing lines inside a Lampiran are taken out of it: UU 12/2011's Lampiran II quotes the
  closing formula as examples (L12 161-173, BAB IV forms) and 52 of its lines become closing
  lines of the law; UU 17/2016 loses the Perppu's 5 closing and TLN lines from its Lampiran.
- A `LAMPIRAN I` quoted inside a Lampiran starts a new one: UU 12/2011 ends with 4 Lampiran
  (I, II, II, I) instead of 2.
- List levels 3 and 4 (`a)`, `1)`, L12 94-95) are not recognised; they stay in the text of the
  level-2 item.
- Old Penjelasan bodies (`A. Pemandangan Umum`, `Fatsal pertama.`, UU 1/1945) are one paragraph.

- No citation is linked yet. `relations.py` reads citations only from titles (in capitals) and
  from an amending law's instructions.

Tests that fail today and pass once these are fixed: `xfail` in `pipeline/tests/` (see
[parser-rules.md](parser-rules.md#known-gaps)).
