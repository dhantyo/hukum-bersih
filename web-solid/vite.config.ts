import solid from "@solidjs/vite-plugin";
import stylexPlugin from "@stylexjs/unplugin";
import { defineConfig } from "vitest/config";

// oxlint-disable-next-line import/no-named-as-default-member -- the package types declare only the default export
const { vite: stylexVite } = stylexPlugin;

export default defineConfig({
  plugins: [
    stylexVite({ useCSSLayers: true, runtimeInjection: false }),
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
  build: { target: "esnext", assetsInlineLimit: 0 },
});
