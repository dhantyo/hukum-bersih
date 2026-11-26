import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright-core";
import type { Browser } from "playwright-core";

import { compare } from "./visual-parity/images.ts";
import { readOptions, ROOT } from "./visual-parity/options.ts";
import type { Options } from "./visual-parity/options.ts";
import { galleryHtml, compareRuns, round } from "./visual-parity/report.ts";
import type { Pair, Summary } from "./visual-parity/report.ts";
import { ROUTES, SCHEMES } from "./visual-parity/routes.ts";
import type { Route, Scheme, Site } from "./visual-parity/routes.ts";
import { originOf, serveAstro, startSolid } from "./visual-parity/servers.ts";
import { shoot } from "./visual-parity/shoot.ts";
import type { Shot } from "./visual-parity/shoot.ts";

interface PlanItem {
  route: Route;
  width: number;
  scheme: Scheme;
  format: string;
  variant: string;
}

const SITES: readonly Site[] = ["astro", "solid"];
const DEFAULT_FORMATS = ["modern"] as const;

const log = (line: string) => {
  process.stdout.write(`${line}\n`);
};

const buildPlan = (options: Options) => {
  const { only } = options;

  const routes =
    only === undefined
      ? ROUTES
      : ROUTES.filter((route) => only.includes(route.id));

  return routes.flatMap((route) =>
    options.widths.flatMap((width) =>
      SCHEMES.flatMap((scheme) =>
        (route.formats ?? DEFAULT_FORMATS).map((format) => ({
          route,
          width,
          scheme,
          format,
          variant: `${width}-${scheme}${route.formats === undefined ? "" : `-${format}`}`,
        }))
      )
    )
  );
};

const runPair = async (browser: Browser, item: PlanItem, runDir: string) => {
  const { route, variant, width, scheme, format } = item;
  const dir = path.join(runDir, route.id, variant);
  await mkdir(dir, { recursive: true });

  const [astro, solid]: Shot[] = await Promise.all(
    SITES.map(
      async (site) =>
        await shoot(browser, {
          site,
          route,
          width,
          scheme,
          format,
          url: `${originOf(site)}${site === "astro" ? (route.astroPath ?? route.path) : route.path}`,
        })
    )
  );

  const result = compare(astro.png, solid.png);
  await Promise.all([
    writeFile(path.join(dir, "astro.png"), astro.png),
    writeFile(path.join(dir, "solid.png"), solid.png),
    writeFile(path.join(dir, "side.png"), result.side),
    writeFile(path.join(dir, "diff.png"), result.diff),
  ]);

  return {
    route: route.id,
    path: route.path,
    variant,
    mismatchPct: round(result.mismatchPct),
    astro: { size: result.astroSize, pageHeight: astro.pageHeight },
    solid: { size: result.solidSize, pageHeight: solid.pageHeight },
    truncated: astro.truncated || solid.truncated,
    dir: `${route.id}/${variant}`,
  };
};

const drain = async (
  queue: PlanItem[],
  browser: Browser,
  runDir: string,
  done: Pair[]
) => {
  const item = queue.shift();

  if (!item) {
    return;
  }

  const pair = await runPair(browser, item, runDir);
  done.push(pair);
  log(
    `${pair.mismatchPct.toFixed(2).padStart(6)}%  ${pair.route} ${pair.variant}`
  );
  await drain(queue, browser, runDir, done);
};

const runAll = async (
  browser: Browser,
  plan: PlanItem[],
  options: Options,
  runDir: string
) => {
  const queue = [...plan];
  const done: Pair[] = [];
  await Promise.all(
    Array.from({ length: options.jobs }, async () => {
      await drain(queue, browser, runDir, done);
    })
  );

  return done.toSorted((a, b) => b.mismatchPct - a.mismatchPct);
};

const main = async (options: Options) => {
  const runDir = path.resolve(ROOT, ".snapshots/visual", options.run);
  await mkdir(runDir, { recursive: true });
  const astroServer = await serveAstro(options.astroDist);
  const solidServer = await startSolid(options.corpus);
  const browser = await chromium.launch({ executablePath: options.chromium });

  try {
    const pairs = await runAll(browser, buildPlan(options), options, runDir);

    const [built, release] = await Promise.all([
      stat(path.join(options.astroDist, "index.html")),
      readFile(path.join(options.corpus, "active-release"), "utf-8"),
    ]);

    const summary: Summary = {
      run: options.run,
      astroDist: options.astroDist,
      astroDistBuilt: built.mtime.toISOString(),
      corpusRelease: release.trim(),
      meanMismatchPct:
        pairs.reduce((sum, pair) => sum + pair.mismatchPct, 0) / pairs.length,
      pairs,
    };

    await writeFile(
      path.join(runDir, "summary.json"),
      `${JSON.stringify(summary, null, 2)}\n`
    );
    await writeFile(path.join(runDir, "index.html"), galleryHtml(summary));
    log(`\nGallery: ${path.join(runDir, "index.html")}`);
  } finally {
    await browser.close();
    astroServer.close();
    solidServer.kill();
  }
};

const args = process.argv.slice(2);
const compareAt = args.indexOf("--compare");

if (compareAt === -1) {
  await main(readOptions(args));
} else {
  process.exitCode = await compareRuns(
    args[compareAt + 1] ?? "",
    args[compareAt + 2] ?? ""
  );
}
