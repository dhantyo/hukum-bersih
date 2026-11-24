import type { StartMiddleware } from "@solidjs/vite-plugin";

import { catalogResponse } from "./server/catalog";
import { collectionComparison } from "./server/collection-comparison";
import { publicLawCache } from "./server/public-law-cache";
import { searchAssets } from "./server/search-assets";

const catalogEndpoint: StartMiddleware = async (event, next) => {
  const path = new URL(event.request.url).pathname;

  if (event.request.method !== "GET" || path !== "/cari/laws.json") {
    return await next();
  }

  return await catalogResponse();
};

export default [
  catalogEndpoint,
  collectionComparison,
  searchAssets,
  publicLawCache,
] satisfies StartMiddleware[];
