import type { RequestEvent, ResponseStub } from "@solidjs/web";
import { QueryClientProvider } from "@tanstack/solid-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/solid-router";

import { createQueryClient } from "./lib/queries";
import { createAppRouter } from "./router";

export default async function setup(
  event: RequestEvent & { response: ResponseStub }
) {
  const url = new URL(event.request.url);
  const queryClient = createQueryClient();

  const router = createAppRouter(
    queryClient,
    createMemoryHistory({ initialEntries: [url.pathname + url.search] })
  );

  await router.load();

  // Transfer router status and redirects before Solid sends the response head.
  const result = router._serverResult;

  if (result?.type === "redirect") {
    result.redirect.headers.forEach((value, key) => {
      event.response.headers.set(key, value);
    });
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
}
