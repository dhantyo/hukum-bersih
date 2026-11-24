import { handleRequest } from "./dist/server/server.js";
import type { CorpusBucket } from "./src/server/corpus.ts";

interface Env {
  CORPUS: CorpusBucket;
  CF_VERSION_METADATA?: { id: string };
}

interface WorkerContext {
  waitUntil(task: Promise<unknown>): void;
}

export default {
  async fetch(request: Request, env: Env, context?: WorkerContext) {
    const version = env.CF_VERSION_METADATA?.id;

    const cache = (globalThis.caches as { default?: Cache } | undefined)
      ?.default;

    const publicPages =
      version && cache && context
        ? {
            version,
            cache,
            defer: (task: Promise<void>) => {
              context.waitUntil(task);
            },
          }
        : undefined;

    return await handleRequest(request, {
      event: { locals: { corpus: env.CORPUS, publicPages } },
    });
  },
};
