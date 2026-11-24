import type { StartMiddleware } from "@solidjs/vite-plugin";

import { catalogEndpoint } from "./server/middleware/catalog.ts";
import { collectionComparison } from "./server/middleware/collection-comparison.ts";
import { publicLawCache } from "./server/middleware/public-law-cache.ts";
import { searchAssets } from "./server/middleware/search-assets.ts";

export default [
  catalogEndpoint,
  collectionComparison,
  searchAssets,
  publicLawCache,
] satisfies StartMiddleware[];
