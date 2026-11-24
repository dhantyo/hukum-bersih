import { QueryClient, queryOptions } from '@tanstack/solid-query';
import { getLawOverview, getLawYear } from './catalog';
import { getCollection, getCollections } from './collections';
import { getDraftBill, getDraftText, listDraftBills } from './drafts';
import { getLaw, getLawComparison } from './laws';
import { getSearchResults } from './search';

export function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
}

export function readerQuery(path: string, compareTo?: string, compareFrom?: string) {
  return queryOptions({
    queryKey: ['laws', 'reader', path, compareTo, compareFrom],
    queryFn: () => getLaw(path, compareTo, compareFrom),
  });
}

export const comparisonQuery = (path: string) => queryOptions({
  queryKey: ['laws', 'comparison', path],
  queryFn: () => getLawComparison(path),
});

export const overviewQuery = () => queryOptions({
  queryKey: ['laws', 'overview'],
  queryFn: () => getLawOverview(),
});

export const yearQuery = (year: string) => queryOptions({
  queryKey: ['laws', 'year', year],
  queryFn: () => getLawYear(year),
});

export const collectionsQuery = () => queryOptions({
  queryKey: ['collections'],
  queryFn: () => getCollections(),
});

export const collectionQuery = (slug: string, version = 'latest') => queryOptions({
  queryKey: ['collections', slug, version],
  queryFn: () => getCollection(slug, version),
});

export const searchQuery = (query: string) => queryOptions({
  queryKey: ['search', query],
  queryFn: () => getSearchResults(query),
});

export const draftBillsQuery = () => queryOptions({
  queryKey: ['drafts'],
  queryFn: () => listDraftBills(),
});

export const draftBillQuery = (slug: string) => queryOptions({
  queryKey: ['drafts', slug],
  queryFn: () => getDraftBill(slug),
});

export const draftTextQuery = (slug: string, id: string) => queryOptions({
  queryKey: ['drafts', slug, id],
  queryFn: () => getDraftText(slug, id),
});
