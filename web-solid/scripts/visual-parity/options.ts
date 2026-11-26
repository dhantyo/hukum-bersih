import { existsSync } from "node:fs";
import path from "node:path";

import { DEFAULT_WIDTHS } from "./routes.ts";

export const ROOT = path.resolve(import.meta.dirname, "../..");
const DEFAULT_JOBS = 3;

export interface Options {
  astroDist: string;
  corpus: string;
  run: string;
  only: readonly string[] | undefined;
  widths: readonly number[];
  jobs: number;
  chromium: string | undefined;
}

export const fail = (message: string) => {
  process.stderr.write(`visual-parity: ${message}\n`);

  return process.exit(1);
};

export const readOptions = (args: readonly string[]) => {
  const option = (name: string) => {
    const at = args.indexOf(`--${name}`);

    return at === -1 ? undefined : args[at + 1];
  };

  const astroDist = path.resolve(
    option("astro-dist") ??
      process.env.ASTRO_DIST ??
      path.resolve(ROOT, "../web/dist")
  );

  if (!existsSync(path.resolve(astroDist, "index.html"))) {
    fail(
      `no built Astro site at ${astroDist}. Set ASTRO_DIST or --astro-dist to a web/dist folder.`
    );
  }

  const corpus = path.resolve(
    option("corpus") ??
      process.env.CORPUS ??
      process.env.HUKUM_CORPUS_DIR ??
      path.resolve(ROOT, ".snapshots/corpus")
  );

  if (!existsSync(path.resolve(corpus, "active-release"))) {
    fail(
      `no corpus at ${corpus}. In ../pipeline run: uv run hukum-bersih export-corpus --publish ${corpus}`
    );
  }

  if (!existsSync(path.resolve(ROOT, "dist/server/node.js"))) {
    fail("web-solid is not built. Run `pnpm run build` first.");
  }

  return {
    astroDist,
    corpus,
    run: option("run") ?? new Date().toISOString().replaceAll(/[:.]/gu, "-"),
    only: option("only")?.split(","),
    widths: option("widths")?.split(",").map(Number) ?? DEFAULT_WIDTHS,
    jobs: Number(option("jobs") ?? DEFAULT_JOBS),
    chromium: option("chromium") ?? process.env.CHROMIUM_PATH,
  };
};
