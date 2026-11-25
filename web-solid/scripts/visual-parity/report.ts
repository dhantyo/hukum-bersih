import { readFile } from "node:fs/promises";
import path from "node:path";

import * as v from "valibot";

import { ROOT } from "./options.ts";

export const STABLE_PCT = 0.1;
const DECIMALS = 3;

export interface Pair {
  route: string;
  path: string;
  variant: string;
  mismatchPct: number;
  astro: { size: number[]; pageHeight: number };
  solid: { size: number[]; pageHeight: number };
  truncated: boolean;
  dir: string;
}

export interface Summary {
  run: string;
  astroDist: string;
  astroDistBuilt: string;
  corpusRelease: string;
  meanMismatchPct: number;
  pairs: Pair[];
}

export const round = (value: number) => Number(value.toFixed(DECIMALS));

const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const card = (pair: Pair) => {
  const cut = pair.truncated ? " · cut at the height limit" : "";

  return `<section>
<h2>${escapeHtml(pair.route)} <small>${escapeHtml(pair.variant)}</small> <b>${pair.mismatchPct.toFixed(2)}%</b></h2>
<p><code>${escapeHtml(pair.path)}</code> · Astro ${pair.astro.size.join("×")} (page ${pair.astro.pageHeight}px) · Solid ${pair.solid.size.join("×")} (page ${pair.solid.pageHeight}px)${cut}</p>
<div class="imgs">
<a href="${pair.dir}/side.png"><img loading="lazy" src="${pair.dir}/side.png" alt="Astro (left) beside Solid (right)"></a>
<a href="${pair.dir}/diff.png"><img loading="lazy" src="${pair.dir}/diff.png" alt="pixel diff"></a>
</div>
<p><a href="${pair.dir}/astro.png">astro.png</a> · <a href="${pair.dir}/solid.png">solid.png</a></p>
</section>`;
};

const STYLE = `body{font:14px/1.4 system-ui,sans-serif;margin:16px;background:#fff;color:#111}
section{border-top:1px solid #ccc;padding:12px 0}
h2{margin:0;font-size:16px} h2 b{float:right}
.imgs{display:flex;gap:12px;align-items:flex-start;overflow-x:auto}
.imgs a:first-child{flex:2 1 0;min-width:0}.imgs a:last-child{flex:1 1 0;min-width:0}
img{width:100%;height:auto;max-height:70vh;object-fit:contain;object-position:top left;border:1px solid #ddd}
@media (prefers-color-scheme:dark){body{background:#111;color:#eee}a{color:#8cb4f0}}`;

export const galleryHtml = (summary: Summary) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Visual parity ${escapeHtml(summary.run)}</title>
<style>${STYLE}</style></head><body>
<h1>Visual parity, ${escapeHtml(summary.run)}</h1>
<p>Astro on the left, Solid on the right, then the diff. Worst first. Mean mismatch ${summary.meanMismatchPct.toFixed(2)}% over ${summary.pairs.length} pairs. Astro build: ${escapeHtml(summary.astroDistBuilt)}. Corpus release: ${escapeHtml(summary.corpusRelease)}.</p>
${summary.pairs.map(card).join("\n")}
</body></html>
`;

const savedSummary = v.object({
  pairs: v.array(
    v.object({
      route: v.string(),
      variant: v.string(),
      mismatchPct: v.number(),
    })
  ),
});

const loadSummary = async (name: string) =>
  v.parse(
    savedSummary,
    JSON.parse(
      await readFile(
        path.resolve(ROOT, ".snapshots/visual", name, "summary.json"),
        "utf-8"
      )
    )
  );

const keyOf = (pair: { route: string; variant: string }) =>
  `${pair.route} ${pair.variant}`;

export const compareRuns = async (nameA: string, nameB: string) => {
  const [first, second] = await Promise.all([
    loadSummary(nameA),
    loadSummary(nameB),
  ]);

  const before = new Map(
    first.pairs.map((pair) => [keyOf(pair), pair.mismatchPct])
  );

  const moves = second.pairs
    .map((pair) => ({
      key: keyOf(pair),
      delta: Math.abs(
        pair.mismatchPct - (before.get(keyOf(pair)) ?? Number.NaN)
      ),
    }))
    .toSorted((a, b) => b.delta - a.delta);

  const unstable = moves.filter((move) => !(move.delta <= STABLE_PCT));

  const lines = [
    `pairs: ${moves.length}, largest change: ${moves[0]?.delta.toFixed(DECIMALS)} points (${moves[0]?.key})`,
    ...unstable.map(
      (move) =>
        `UNSTABLE ${move.key} moved ${move.delta.toFixed(DECIMALS)} points`
    ),
  ];

  process.stdout.write(`${lines.join("\n")}\n`);

  return unstable.length === 0 ? 0 : 1;
};
