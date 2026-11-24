import type { StartMiddleware } from '@solidjs/vite-plugin';
import { publicLawCache } from './server/public-law-cache';
import { catalogResponse } from './server/catalog';
import { searchAssets } from './server/search-assets';

const catalogEndpoint: StartMiddleware = (event, next) => {
  const path = new URL(event.request.url).pathname;
  if (event.request.method !== 'GET' || path !== '/cari/laws.json') return next();
  return catalogResponse();
};

export default [catalogEndpoint, searchAssets, publicLawCache] satisfies StartMiddleware[];
