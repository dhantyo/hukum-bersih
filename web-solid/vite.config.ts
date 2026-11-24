import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { defineConfig } from 'vitest/config';
import solid from '@solidjs/vite-plugin';
import stylex from '@stylexjs/unplugin';

export default defineConfig({
  plugins: [
    stylex.vite({ useCSSLayers: true, runtimeInjection: false }),
    tanstackRouter({ target: 'solid', autoCodeSplitting: true }),
    solid({
      start: {
        middleware: './src/middleware.ts',
        serverRenderSetup: './src/setup.tsx',
        nodeServer: true,
      },
      ssr: true,
      serverFunctions: true,
      diagnostics: true,
    }),
  ],
  server: { port: 3000 },
  build: { target: 'esnext', assetsInlineLimit: 0 },
});
