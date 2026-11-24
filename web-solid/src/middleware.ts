import type { StartMiddleware } from '@solidjs/vite-plugin';
import { publicLawCache } from './server/public-law-cache';
import { collectionComparison } from './server/collection-comparison';
import { catalogResponse } from './server/catalog';
import { searchAssets } from './server/search-assets';

const catalogEndpoint: StartMiddleware = (event, next) => {
  const path = new URL(event.request.url).pathname;
  if (event.request.method !== 'GET' || path !== '/cari/laws.json') return next();
  return catalogResponse();
};

export default [catalogEndpoint, collectionComparison, searchAssets, publicLawCache] satisfies StartMiddleware[];
