import solid from "@solidjs/vite-plugin";
import stylex from "@stylexswc/unplugin/vite";
import { fontless } from "fontless";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const FONT_STACKS = [
  { family: "Public Sans", generic: "sans-serif", preload: true },
  {
    family: "Atkinson Hyperlegible Next",
    generic: "sans-serif",
    preload: true,
  },
  { family: "Source Serif 4", generic: "serif", preload: false },
  { family: "Literata", generic: "serif", preload: false },
] as const;

const FALLBACK_PROBE_ID = "virtual:font-fallbacks.css";

const fontFallbackProbe = () =>
  ({
    name: "font-fallback-probe",
    resolveId: (id) => (id === FALLBACK_PROBE_ID ? `\0${id}` : undefined),
    load: (id) =>
      id === `\0${FALLBACK_PROBE_ID}`
        ? FONT_STACKS.map(
            ({ family, generic }, index) =>
              `.font-stack-${index}{font-family:"${family}",${generic}}`
          ).join("\n")
        : undefined,
  }) satisfies Plugin;

export default defineConfig({
  plugins: [
    fontless({
      families: FONT_STACKS.map(({ family, preload }) => ({
        name: family,
        provider: "fontsource" as const,
        global: true,
        preload,
      })),
      defaults: { weights: ["100 900"], styles: ["normal"] },
      assets: { prefix: "/assets/_fonts" },
    }),
    fontFallbackProbe(),
    stylex({ useCSSLayers: true }),
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
  ],
  server: { port: 3000 },
  optimizeDeps: { exclude: ["@ui-sdk/core"] },
  build: { target: "esnext", assetsInlineLimit: 0 },
  test: { passWithNoTests: true },
});
