import { handleRequest } from './dist/server/server.js';

export default {
  fetch(request, env, context) {
    const version = env.CF_VERSION_METADATA?.id;
    const cache = globalThis.caches?.default;
    const publicPages = version && cache && context
      ? { version, cache, defer: (task) => context.waitUntil(task) }
      : undefined;
    return handleRequest(request, {
      event: { locals: { corpus: env.CORPUS, publicPages } },
    });
  },
};
