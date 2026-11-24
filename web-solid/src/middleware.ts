import type { StartMiddleware } from '@solidjs/vite-plugin';
import { publicLawCache } from './server/public-law-cache';
import { searchAssets } from './server/search-assets';

export default [searchAssets, publicLawCache] satisfies StartMiddleware[];
