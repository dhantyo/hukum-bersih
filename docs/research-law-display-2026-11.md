# How other countries show law on screen (looked at 2026-11-21)

For the "Asli / Modern" view switch on law pages (asked by Dante). Pages were opened live;
Fedlex, e-Gov and New Zealand were rendered in a browser (they need JavaScript).

| Site | View options | Preamble / enacting words | Headings | Signatures, dates | Explanatory notes |
|---|---|---|---|---|---|
| legislation.gov.uk (UK) | "Original (As enacted)" vs "Latest available (Revised)"; "Plain View"; "Show Timeline of Changes"; "Show Geographical Extent"; "Opening Options" (whole Act / without Schedules) | "Introductory Text": long title, "[8th April 2010]", "Be it enacted by …" as plain text | "Part 1 Socio-economic inequalities": title case, no full stop | date of assent in brackets under the long title | separate "Explanatory Notes" tab; a section only says whether notes exist |
| legislation.govt.nz (New Zealand) | "Section view", "Versions", "Download", "Hide/show content" with switches ("Repealed sections and history notes", "Empowering provision information notes") | one bold line "The Parliament of New Zealand enacts as follows:" | "Part 1 / Preliminary provisions" centred, title case; section number in a left column, bold heading | facts table under the title: "Public Act 2020 No 31", "Date of assent 30 June 2020", "Commencement see section 2" | not applicable |
| fedlex.admin.ch (Switzerland) | "Alles einblenden / Artikelübersicht / Alles ausblenden" (expand/collapse every heading); versions list with HTML/XML/PDF/DOC per date; "Sprachenvergleich", "Versionenvergleich" | Ingress as a few italic lines ("Die Bundesversammlung …, gestützt auf …, beschliesst:") with footnotes | "A. Anwendung des Rechts", "Art. 1": collapsible; paragraphs numbered with superscripts | facts box: Beschluss, Inkrafttreten, Quelle (AS 24 233), "Dieser Text ist in Kraft" | footnotes directly under each article |
| laws.e-gov.go.jp (Japan) | eye icon per part: 制定文 (enactment text), 目次 (contents), 本則 (main provisions), each chapter and article; "全表示 / 全非表示" (show all / hide all); tabs 条文 / 条文比較 / 引用元 | enactment text as its own part, can be hidden | article with title in parentheses: "第一条（基本原則）" | revision list on the left, each with the amending law | not applicable |
| eur-lex.europa.eu (EU) | "Expand all / Collapse all"; "Multilingual display" (up to 3 languages side by side); tabs Text / Document information / Procedure | citations "Having regard to …", then "Whereas:" and numbered recitals (1), (2) … | not checked | not checked | not applicable |
| rechtsinformationen.bund.de (Germany, NeuRIS) | tabs "Text / Details / Gesamtausgaben"; "Amtliches Inhaltsverzeichnis einblenden" | not checked | "§ 1 Allgemeines": number and title on one line, linked | metadata in "Details" | not applicable |

Not reachable from the Claude container: sso.agc.gov.sg (Singapore, 403), law.go.kr (Korea, no
connection). law.go.kr was read as text by a fetcher: tabs "3단비교", "신구법비교", "법령체계도",
toggles "본문 전체 열기", "부칙" (supplementary provisions) as a collapsible list.

What this suggests for Indonesian law (mockup: claude.ai artifact "Tampilan UU 4/2009"):
- Keep the official layout one click away (UK "Original (As enacted)", our "Asli").
- Facts box for the closing instead of signature blocks (New Zealand, Fedlex): disahkan,
  diundangkan, Lembaran Negara, Tambahan Lembaran Negara.
- Per-part show/hide (e-Gov) and switches for notes (New Zealand).
- Explanations next to the provision they explain (Fedlex footnotes) as an option, the official
  separate Penjelasan as the other; "Cukup jelas" shown by default, hideable (Dante).
- Headings in normal capitals with number and title on one line (UK, NZ, Germany) in Modern;
  the stored text keeps the capitals as published.
