# Handover: Asli / Modern view of law pages (2026-11-21)

For the UI agent. Agreed with Dante; the parser work that feeds it is in progress
(docs/parser-review-2026-11.md).

- Mockup (private, ask Dante for access): https://claude.ai/artifact/6Y9FQw32pYqPUUvDjbTXkD
  (UU 4/2009, real text from BPK's PDF, shortened). Version 3 is the agreed direction.
- Research on how other countries show law: docs/research-law-display-2026-11.md.

## What Dante asked for

- A reader setting **Format: Asli / Modern**. Asli = faithful to the official layout (centred
  capitals, Menimbang column, signature blocks as printed). Modern = screen layout.
  The stored text never changes (CLAUDE.md, text fidelity); Modern only changes display
  (capitals of headings and names, layout).
- **Penjelasan: di akhir / di bawah pasal.** "Cukup jelas" is shown by default; a switch hides it.
- **Bagian yang ditampilkan:** show/hide Pembukaan, Batang Tubuh, Penutup, Penjelasan
  (like e-Gov's eye toggles).
- **BAB and Pasal headings clickable to fold/unfold**, with "Buka semua / Tutup semua";
  a link to a pasal opens the blocks around it.
- **One standard for hierarchy labels**: Penjelasan's "Ayat (1)", "Huruf d", "Angka 3" shown
  as (1), d., 3. in Modern, laid out like lists in the body (huruf indented under ayat).
- **Not too many boxes** (Dante, on version 2): no cards around BAB/Pasal; headings plain with a
  thin rule above BAB; the fold arrow hangs in the left margin so headings align with the text;
  Penjelasan under a pasal marked by a thin left rule, not a filled box; the closing as a plain
  definition list.
- Modern closing = facts list: Disahkan (place, date, name, office), Diundangkan (same),
  Lembaran Negara, Tambahan LN, perintah pengundangan, Salinan.
- Table of contents and the settings in the side panel (above the text on phones).
- Settings remembered per reader (localStorage), like the existing "Aa" reading settings.

## What the parser will deliver (Akoma Ntoso)

Each part detected: preface (title), preamble (formula, jabatan, Menimbang items, Mengingat
items, persetujuan, MEMUTUSKAN, Menetapkan), body (BAB > Bagian > Paragraf > Pasal > ayat >
lists), conclusions (perintah pengundangan; disahkan/diundangkan each with place, date,
office, name; LN; salinan block), Penjelasan (Umum, Pasal demi Pasal with entries linked to
their pasal, labels kept as printed plus a normalised form), Lampiran. Field names will be
documented in docs/ARCHITECTURE.md when the parser lands.
