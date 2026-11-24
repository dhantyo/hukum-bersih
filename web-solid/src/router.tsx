import { createRouter, type RouterHistory } from '@tanstack/solid-router';
import { routeTree } from './routeTree.gen';

export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    trailingSlash: 'always',
    history,
    defaultPreload: 'intent',
    defaultPendingComponent: () => <main>Memuat…</main>,
    disableGlobalCatchBoundary: true,
  });
}

declare module '@tanstack/solid-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
