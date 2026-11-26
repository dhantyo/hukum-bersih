import type { StartMiddleware } from "@solidjs/vite-plugin";

import { collectionComparison } from "./server/middleware/collection-comparison.ts";
import { publicLawCache } from "./server/middleware/public-law-cache.ts";
import { releaseData } from "./server/middleware/release-data.ts";
import { searchAssets } from "./server/middleware/search-assets.ts";
import { trailingSlash } from "./server/middleware/trailing-slash.ts";

export default [
  trailingSlash,
  collectionComparison,
  releaseData,
  searchAssets,
  publicLawCache,
] satisfies StartMiddleware[];
