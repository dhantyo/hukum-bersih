import solid from "@solidjs/vite-plugin";
import stylex from '@stylexjs/unplugin';
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    stylex.vite({ useCSSLayers: true, runtimeInjection: false }),
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
