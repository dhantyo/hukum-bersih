import solid from "@solidjs/vite-plugin";
import stylex from "@stylexswc/unplugin/vite";
import { fontless } from "fontless";
import { defineConfig } from "vitest/config";

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
  ],
  server: { port: 3000 },
  optimizeDeps: { exclude: ["@ui-sdk/core"] },
  build: { target: "esnext", assetsInlineLimit: 0 },
  test: { passWithNoTests: true },
});
