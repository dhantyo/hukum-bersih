import { GET } from '@solidjs/web/server-functions';
import { readCatalog } from '../server/catalog';
import { readActiveRelease } from '../server/corpus';
import { searchMatches } from './search-matches';

export const getSearchResults = GET(async (query: string) => {
  'use server';
  const release = await readActiveRelease();
  const cleaned = typeof query === 'string' ? query.trim().slice(0, 200) : '';
  const catalog = cleaned ? searchMatches(cleaned, await readCatalog()) : undefined;
  return { release, catalog, query: cleaned };
});
