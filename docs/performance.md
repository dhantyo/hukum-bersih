# Performance: how we measure and what we learned

The reader in `web/` serves very large documents. UU 11/2020 alone prerenders to about 7.7 MB of HTML and 88k DOM nodes. That size has decided most of the architecture, so check a change against it before you trust it. This file records how to measure and what each past mistake taught. The decisions themselves are in `docs/decisions/` (0018 to 0020).

## Measure before you change

- **Measure the real artifact.** Build with a fresh corpus (`HUKUM_CORPUS_DIR`, see `web/README.md`) and serve `dist/client` as static files, the way the Cloudflare Worker serves it. Do not measure the node server: it re-renders each page on request, which Cloudflare never does.
- **Use the same harness on both sides.** Use headless Chromium through playwright-core, with 4× CPU throttle and a phone viewport (412×823, DPR 2.625). Take the median of 5 runs, and alternate the runs between the base and the change (A, B, A, B) so machine load hits both equally. Record total blocking time, long tasks, JS heap, FCP and LCP. Check that each run did the work: no errors, no 4xx, same DOM node count.
- **Attribute the time before you fix anything.** Take a CPU profile or a Performance trace and split the time into script, style, layout and paint. Name the function that caused each forced layout or full style recalculation. A fix aimed at a guessed cause has failed here more than once.
- **Measure Worker CPU on the Worker.** Run `wrangler dev` with the inspector profiler on the user isolate. Summing process CPU counts the local R2 simulator too, which production never pays. A local number is a guide, not proof of the 10 ms free-plan limit.
- **Trace invalidations, not only time.** A profile says where time went; a Performance trace with invalidation tracking says which change made the browser restyle or relayout, and the JS stack that forced it. Fonts reloading, sheets inserted and attributes written all show up there and nowhere else.
- **Bound a fix with a ceiling test before building it.** Strip the suspect from the built output (patch the JS, delete the CSS rules) and measure. If even removing it entirely saves little, do not build the proper fix. This ruled out patching ui-sdk Resizable (about 90 ms) and sized the `:has()` redesign (about 0.5 s).
- **Probe single operations on the real page.** Time one `setAttribute`, one stylesheet insert or one `getBoundingClientRect` in the loaded document from the console or a script. Costs depend on the document's size, so a probe on a small test page misleads.
- **Prove motion frame by frame.** For anything that slides or follows (the header, the sticky panel, the compare pills), record each element's position on every animation frame and assert the invariant, for example "the gap between header and panel is constant". Do not judge motion from code or from one screenshot.

## Lessons

### The Worker's CPU limit decides where work runs (2026-11-26)

On the free plan a Worker gets 10 ms of CPU per request. An uncached render of UU 11/2020 took about 1,074 ms, and BUMN about 220 ms, so both failed with Error 1102. No tuning of a render gets 100× faster.

- **Prerender every public page at build and serve it as a static asset** (decision 0019). Cloudflare serves the file without running the Worker. Use Solid's own `prerender-crawler`; do not write a crawler.
- **Move per-request work into the browser when it cannot be prerendered.** Comparisons build from published pair files (decision 0018). Search runs over the catalog and Pagefind (decision 0020). Only the no-JavaScript search (`/cari/hasil/`) still renders on the Worker, at about 10 ms per query.
- **An edge cache does not rescue a render that fails.** The first, uncached request still runs into the limit. The Cache API also does nothing on `*.workers.dev`.

### Ship precomputed results, not engines (2026-11-26)

We tried computing comparison diffs in the browser with a port of the pipeline's diff. It took a median 407 ms per change at 4× throttle, against 102 ms for building from published pair files. The pipeline already computes the diff once, so ship its output. Halving the pair files (writing only older→newer) cost nothing, because nothing read the reverse direction.

### Hydration cost grows with the text, not with interactivity (2026-11-26)

Hydrating the plain law text created a reactive owner for each DOM node. On UU 11/2020 that was 44% of main-thread time, about 13 s of blocking time at 4× throttle, and 245 MB of heap. The text has no interactive parts of its own.

- **Leave inert text unhydrated.** `LawText` (`web/src/components/law-text.tsx`) renders the plain text inside `<NoHydration>`. The same page went to 5.2 s of blocking time and 12 MB of heap (PR #36).
- **The trade-off.** A handler or ref inside the unhydrated tree never runs, so attach listeners outside it. Links inside it get no hover preload.
- **Serialized data is cheap in CPU but costs bytes.** A page holding only the hydration data ran about 0.7 s of long tasks on UU 11/2020. That data is still about half of a law page's compressed HTML.

### Native elements beat a component per node

A ui-sdk `Collapsible` per fold measured slower on UU 11/2020 than native `<details>`. `<details>` costs no script, opens on find-in-page and `#pasal-N`, and works without JavaScript. Use a component for the one or two disclosures on a page, never for one per node of a long text. Virtualising the text was ruled out because it breaks Ctrl+F. `content-visibility: auto` keeps the text findable while skipping layout for what is off screen.

### Animate transforms from one trigger, never layout properties (2026-11-26)

The sticky side panel jumped when the header slid back in. Two fixes failed before the third worked:

1. **A transitioned custom property on `<html>`** that drove the panel's `top` and height. The browser restyled and relaid the document on every frame, while the header's transform ran off the main thread, so the two drifted apart.
2. **A transform tied to the header's mode** that moved the panel whenever the header hid. That included when the panel was not yet stuck, so the panel was pulled out of place near the top of the page.

What worked: on each show/hide flip, measure which marked elements (`data-under-header`) the flip actually moved, then start one Web Animation per element with the header transition's own duration and easing (`slideFollowers` in `web/src/lib/header-follow.ts`). A per-frame record showed the header-to-panel gap constant to 0.1 px. Both failures shared one wrong premise: that the follower should react to the header's mode. Whether it moves depends on whether it is stuck, which only a measurement can tell.

### "No jump" means the layout stays put, not a smoother animation (2026-11-26)

Folds looked like they jumped when opened. A height animation did not help, because the cause was spacing: heading styles under `:not([open])` gave closed folds different margins from open ones, so every trigger moved 40 px. Make spacing around a trigger independent of its state ([web/docs/document-pages.md](../web/docs/document-pages.md#collapsibles)). Check it by recording each summary's position before and after toggling. It must not move.

### Find who invalidated the layout before you blame the reads (2026-11-27)

After #36, about 68% of what remained on UU 11/2020 was native style and layout: three full layouts and six full style recalculations during start-up. The first profile blamed our own reads (ui-sdk Resizable's measurement, header-follow's slot sizing). A trace with invalidation tracking showed otherwise: two of the three layouts came from ui-sdk inserting its `<style>` sheets at the front of `<head>`, ahead of the sheet with the `@font-face` rules. Each insert rebuilt the font set, so the whole document was laid out again, at about 240 ms each.

- **Let ui-sdk use constructed sheets.** A `csp-nonce` meta in `web/src/document.tsx` switches it to adopted stylesheets, and `@layer ui-sdk, reset;` in `web/src/styles/stylex.css` keeps the cascade order. Layout time on UU 11/2020 went from 3.5 s to 0.8 s.
- **Write page-level state only when it changes.** header-follow wrote a root custom property equal to its default at start-up (`web/src/lib/header-follow.ts`); it now writes only on a change.
- **Measure what a suspect costs before you fix it.** Rewriting the `<html>` preference attributes with the same values measured free. Patching out Resizable's measurement saved about 90 ms, within noise. Neither was changed.
- **Next limit.** Rules anchored on `<html>` with `:has()` (`COMPARING`, `FOLDED`, `COLUMNS`, `ONLY_CHANGED`, `SHOW_SAME`) make any insert anywhere restyle the whole document. Stripping them saved about 0.5 s more on UU 11/2020, but they carry the no-JavaScript comparison layout, so replacing them is its own task.

## Measured numbers

Each row was measured with the harness above: headless Chromium, 4× CPU throttle, phone viewport, median of 5, on static files.

| Page | Before #36 (TBT, heap) | After #36 (TBT, heap) | After #39 (TBT) |
|---|---|---|---|
| /uu/11/2020/ | 13.0 s, 245 MB | 5.2 s, 12 MB | 3.3 s |
| /koleksi/bumn/ | 3.2 s, 52 MB | 1.5 s, 6 MB | 0.9 s |
| /koleksi/minerba/ | 3.5 s, 50 MB | 1.5 s, 7 MB | 1.0 s |
| draft (perampasan-aset) | 1.9 s, 27 MB | 0.6 s, 5 MB | 0.5 s |
| /uu/11/2008/ | 1.3 s, 16 MB | 0.7 s, 6 MB | 0.45 s |

Worker CPU per request (`wrangler dev`, inspector profiler, median of 9, 2026-11-26):

| Request | Rendered on the Worker | Now |
|---|---|---|
| /uu/11/2020/ | 1,074 ms | static asset, no Worker CPU |
| /koleksi/bumn/ | 220 ms | static asset |
| /cari/?q=… | 18–28 ms | static page, search in the browser |
| /cari/hasil/?q=… (no JavaScript) | — | about 10 ms |

Add a row when a change moves one of these numbers, and give the date and the PR.
