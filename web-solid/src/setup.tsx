import type { RequestEvent, ResponseStub } from "@solidjs/web";
import { QueryClientProvider } from "@tanstack/solid-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/solid-router";

import { createQueryClient } from "./lib/queries";
import { createAppRouter } from "./router";

const setup = async (event: RequestEvent & { response: ResponseStub }) => {
  const url = new URL(event.request.url);
  const queryClient = createQueryClient();

  const router = createAppRouter(
    queryClient,
    createMemoryHistory({ initialEntries: [url.pathname + url.search] })
  );

  await router.load();

  const result = router._serverResult;

  if (result?.type === "redirect") {
    for (const [key, value] of result.redirect.headers) {
      event.response.headers.set(key, value);
    }

    event.response.status = result.redirect.status;

    return () => null;
  }

  if (result) {
    event.response.status = result.status;
  }

  return () => (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
};

export default setup;
