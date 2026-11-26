import { readFileSync } from "node:fs";
import nodePath from "node:path";

import { serverFunctions } from "@solidjs/prerender/integration";
import solid from "@solidjs/vite-plugin";
import stylex from "@stylexswc/unplugin/vite";
import { fontless } from "fontless";
import { report } from "prerender-crawler";
import { prerender } from "prerender-crawler/vite";
import * as v from "valibot";
import { defineConfig } from "vitest/config";

import { staticPagePath } from "./src/lib/schemas.ts";

const corpusRelease = () => {
  const directory = process.env.HUKUM_CORPUS_DIR;

  return directory === undefined
    ? ""
    : readFileSync(nodePath.join(directory, "active-release"), "utf-8").trim();
};

const everyLinkedPageRenders = {
  name: "every-linked-page-renders",
  teardown: ({ skipped }: { skipped: readonly { path: string }[] }) => {
    const failed = skipped.filter(({ path }) => !path.startsWith("/perppu/"));

    if (failed.length > 0) {
      throw new Error(
        `Pages that did not render: ${failed.map(({ path }) => path).join(", ")}`
      );
    }
  },
};

const slashed = (path: string) => (path.endsWith("/") ? path : `${path}/`);

const FONT_STACKS = [
  { family: "Public Sans", preload: true },
  { family: "Atkinson Hyperlegible Next", preload: true },
  { family: "Source Serif 4", preload: false },
  { family: "Literata", preload: false },
] as const;

export default defineConfig({
  plugins: [
    fontless({
      families: FONT_STACKS.map(({ family, preload }) => ({
        name: family,
        provider: "google",
        preload,
      })),
      defaults: { weights: ["100 900"], styles: ["normal"] },
      assets: { prefix: "/assets/_fonts" },
    }),
    stylex({ useCSSLayers: true, useCssPlaceholder: true }),
    solid({
      start: {
        middleware: "./src/middleware.ts",
        document: "./src/document.tsx",
        renderMode: "async",
        nodeServer: true,
      },
      ssr: true,
      serverFunctions: true,
      diagnostics: true,
    }),
    prerender({
      mode: "hybrid",
      emitPages: true,
      pages: ["/", "/tentang/", "/uu/", "/koleksi/", "/ruu/"],
      concurrency: 4,
      filter: (path) => v.is(staticPagePath, slashed(path)),
      failOnError: false,
      integrations: [
        serverFunctions(),
        everyLinkedPageRenders,
        report({ filename: "../prerender-report.json" }),
      ],
    }),
  ],
  define: {
    "import.meta.env.CORPUS_RELEASE": JSON.stringify(corpusRelease()),
  },
  server: { port: 3000 },
  optimizeDeps: { exclude: ["@ui-sdk/core"] },
  build: { target: "esnext", assetsInlineLimit: 0 },
  test: { passWithNoTests: true },
});
