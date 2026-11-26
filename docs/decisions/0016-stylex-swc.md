# 0016 StyleX through the SWC plugin, with one marker stylesheet

Date: 2026-11-25 · Decided by: the operator; change by Claude

## What

`web-solid/` compiles StyleX with `@stylexswc/unplugin` (the Rust compiler), not the official `@stylexjs/unplugin`.

- `src/styles/stylex.css`, imported in `src/app.tsx`, is the one CSS file of our own. It holds the
  `@stylex;` marker and the four font stacks as `--font-*` custom properties.
- The plugin runs with `useCssPlaceholder: true`. It replaces the marker with the StyleX rules in dev
  and in the build, so they ship in the hashed stylesheet that the Solid render already links.
- `fontless` rewrites the `--font-*` stacks in that file with metric-adjusted fallbacks.
  `font` in `src/styles/tokens.stylex.ts` only points at them.

## Why

- The operator chose the SWC compiler.
- With the plugin's defaults, production pages had no StyleX rules (0 classes in the linked
  stylesheet). The plugin wrote a standalone `stylex.css` that nothing linked, and dev pages had
  none either. The `/virtual:stylex.css` link from the official guide returns 404 with this plugin.
  The plugin's injection depends on a Vite HTML hook that the Solid server render never runs.
- The marker has to sit in a real stylesheet that JavaScript imports. In a virtual module the dev
  server left it unfilled.
- StyleX rules are inserted after Vite's CSS transforms, so `fontless` never sees them. The stacks
  therefore live in the marker file, where `fontless` processes `--font-*` properties by default.
  That replaced a probe stylesheet and fallback names copied by hand.
- Checked 2026-11-25 in headless Chromium on the prod build. Across 364,444 elements in 104 page
  states, computed styles were identical to the build before the switch, apart from the
  `font-family` string that `fontless` now writes. Dev renders with styles and fonts.

## Revisit when

- `@stylexswc/unplugin` links its stylesheet without `transformIndexHtml`. Then the marker could go.
- `fontless` can read StyleX's output. Then the stacks could move back into `tokens.stylex.ts`.
- The official plugin gains something the SWC one lacks. Switching back means appending to the
  marker stylesheet and porting the guide's `DevStyleXInject` for dev.
