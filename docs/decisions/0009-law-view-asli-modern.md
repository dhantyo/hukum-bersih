# 0009 Law view: Asli and Modern

Date: 2026-11-21 · Asked by Dante; handover from the parser agent (docs/handoff-law-view.md,
mockup "Tampilan UU 4/2009"); built by the UI agent

Law pages get a reader setting **Format: Asli / Modern**. Asli lays the text out as the
official copy (centred capitals, Pembukaan open, signatures as printed); Modern is a screen
layout (headings in normal capitals and left-aligned, Pembukaan folded, the closing under
"Pengesahan dan pengundangan"). Modern is the default. Readers can also put Penjelasan under
each pasal or hide it, hide "Cukup jelas", hide parts, and fold BAB / Bagian / Paragraf / Pasal.

Why: Indonesian laws are long and their printed layout (capitals, centred headings, the
Penjelasan far from the pasal it explains) is hard to read on a screen, but lawyers need the
official layout one click away. Pattern from legislation.gov.uk ("Original (As enacted)"),
Fedlex (expand/collapse, notes under articles), e-Gov (show/hide parts)
(docs/research-law-display-2026-11.md).

How: the page is rendered once; the choices are attributes on `<html>` set before first paint
(like the "Aa" font setting), and CSS switches. Modern headings are generated at build time
next to the printed ones (only one is shown; search indexes the printed one). Penjelasan entries
are moved under their pasal by a few lines of script, not duplicated. Folded content uses
`hidden="until-found"`, so find-in-page still finds it.

Text fidelity (CLAUDE.md): the stored text never changes. Modern changes only the display of
capitals in headings and the style of Penjelasan labels.

Given up / later: the Modern closing as a facts list (Disahkan, Diundangkan, Lembaran Negara,
Tambahan LN) and Menimbang / Mengingat folded separately need the parser's structured
preamble and conclusions; until then both are shown as printed. Fold state is not remembered
between visits (it would apply to every law).
