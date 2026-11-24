import type { StartMiddleware } from "@solidjs/vite-plugin";

import { readCatalogJson } from "../records/catalog.ts";

export const catalogEndpoint: StartMiddleware = async (event, proceed) => {
  const { pathname } = new URL(event.request.url);

  if (event.request.method !== "GET" || pathname !== "/cari/laws.json") {
    return await proceed();
  }

  return new Response(await readCatalogJson(), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
