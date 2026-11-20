# 0004 Akoma Ntoso, stored as Bluebell text

Date: 2026-11-20 · Decided by: Dante

Legal texts are modelled in Akoma Ntoso (OASIS LegalDocML), the international standard used
by the EU, UN bodies and many parliaments. In git we store **Bluebell** text, Laws.Africa's
plain-text markup that maps 1:1 to Akoma Ntoso; XML is generated at build time.

Why: a standard model instead of our own; every ayat/huruf gets a standard id
(`chp_III__art_5__para_1__point_a`) for links, comparisons and later amendments; interoperable
with Pasal.id (also Akoma Ntoso based) and Laws.Africa tools (law-widgets). Bluebell keeps
diffs as clean as plain text, which raw XML would not.

Replaces our own Markdown format (used briefly for M1).

Mapping: BAB→chapter, Bagian→part, Paragraf→subpart, Pasal→article, ayat→paragraph,
huruf/angka→point, Penjelasan→attachment (Umum / Pasal demi Pasal as parts),
Menimbang/Mengingat→preamble, signatures→conclusions.

Rejected: Laws.Africa's Indigo platform (needs a database server, against "git is the source
of truth, static hosting"); storing XML in git (noisy diffs).
