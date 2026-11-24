import type { QueryClient } from "@tanstack/solid-query";
import { createRouter } from "@tanstack/solid-router";
import type { RouterHistory } from "@tanstack/solid-router";

import { routeTree } from "./routeTree.gen";

export interface RouterContext {
  queryClient: QueryClient;
}

export const createAppRouter = (
  queryClient: QueryClient,
  history?: RouterHistory
) =>
  createRouter({
    routeTree,
    trailingSlash: "always",
    history,
    context: { queryClient },
    defaultPreload: "intent",
    defaultPendingComponent: () => <main>Memuat…</main>,
    disableGlobalCatchBoundary: true,
  });

declare module "@tanstack/solid-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
