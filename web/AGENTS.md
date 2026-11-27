# Web notes

Solid 2 on a Cloudflare Worker. `pnpm run check` enforces the style rules; this file and the topic docs below hold the ones it cannot. Copy the named file when you add a new one of the same kind.

## Rules for every task

- Use pnpm. Ultracite runs the lint and format: `pnpm exec ultracite fix`, `check`, `doctor`. Its code standards are the `ultracite` skill (`references/code-standards.md`).
- Style with StyleX only, with tokens from `src/styles/tokens.stylex.ts`, never a raw `var(--x)`.
- Before you hand-build an interactive control (toggle, picker, menu, disclosure, dialog, tooltip, tabs, a `role=` or `aria-expanded` attribute, a key or click handler on a non-link), use a ui-sdk component or behavior. Hand-built needs a reason in the PR. Follow the `ui-sdk` skill.
- Write Solid 2, not Solid 1.x and not React. Follow the `solid-2.0` skill before you write Solid code. The three rules that cause most bugs:
  1. Read props, don't destructure them; pass values, not accessors (`<C value={count()} />`).
  2. `createEffect` takes two functions, compute then apply: `createEffect(() => count(), v => { el.title = v; })`.
  3. Write stores through the draft: `setStore(s => { s.user.name = "B"; })`.
- A dev warning `[CODE]` names its section in the `reactivity-diagnostics` skill. Fix the cause; never suppress a code.
- Prove a refactor changes no behaviour with `scripts/route-snapshot.sh` (see its header) before and after, and diff.

## Read when you need it

| Before you | Read |
|---|---|
| Add a file in `src/`, a published record, a server function, a query or a component | `docs/code-layout.md` |
| Add a route or page, read search params, write a link, show pending state | `docs/routes.md` |
| Style something, touch `styles/stylex.css` or fonts, build an interactive control | `docs/styling.md` |
| Change the law, draft or collection page layout, the side panel, folds or collapsibles | `docs/document-pages.md` |
| Touch the header that follows the scroll, anything sticky under it, or the comparer's pill and column motion | `docs/motion.md` |
| Read the corpus, add a published field, or change the comparer | `docs/comparer.md` |
| Change search (`/cari/`, `/cari/hasil/`, Pagefind) | `docs/search.md` |
| Change something that could make a page slower, or measure speed | `../docs/performance.md` |
