# 0007 Design direction

Date: 2026-11-21 · Decided by Claude on Dante's instruction to iterate on the design alone

A calm reference work, not a startup site. Direction taken from legislation.gov.uk, Fedlex,
the GOV.UK design system and La Fabrique de la Loi (rendered and inspected 2026-11-21):
metadata panel beside the text, breadcrumbs, table of contents, prominent search, white page,
one link color, status colors. Public Sans for the interface, Source Serif 4 for legal text.
No brand red, because red means "deleted" in comparisons. Full system: `DESIGN.md`; tokens:
`web/src/styles/tokens.css`.

Also: every imported UU gets a page (`/uu/<nomor>/<tahun>/`, per docs/NAMING.md), with year
lists, and search runs on Pagefind's own UI at `/cari/`.

UXKIN's design library was not available (needs a sign-in), so the comparison is with the four
sites above only.
