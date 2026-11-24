import { QueryClient, queryOptions } from "@tanstack/solid-query";

import { getLawOverview, getLawYear } from "./catalog";
import { getCollection, getCollections } from "./collections";
import { getDraftBill, getDraftText, listDraftBills } from "./drafts";
import { getLaw, getLawComparison } from "./laws";
import { getSearchResults } from "./search";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  });
}

export function readerQuery(
  path: string,
  compareTo?: string,
  compareFrom?: string
) {
  return queryOptions({
    queryKey: ["laws", "reader", path, compareTo, compareFrom],
    queryFn: async () => await getLaw(path, compareTo, compareFrom),
  });
}

export const comparisonQuery = (path: string) =>
  queryOptions({
    queryKey: ["laws", "comparison", path],
    queryFn: async () => await getLawComparison(path),
  });

export const overviewQuery = () =>
  queryOptions({
    queryKey: ["laws", "overview"],
    queryFn: async () => await getLawOverview(),
  });

export const yearQuery = (year: string) =>
  queryOptions({
    queryKey: ["laws", "year", year],
    queryFn: async () => await getLawYear(year),
  });

export const collectionsQuery = () =>
  queryOptions({
    queryKey: ["collections"],
    queryFn: async () => await getCollections(),
  });

export const collectionQuery = (slug: string, version = "latest") =>
  queryOptions({
    queryKey: ["collections", slug, version],
    queryFn: async () => await getCollection(slug, version),
  });

export const searchQuery = (query: string) =>
  queryOptions({
    queryKey: ["search", query],
    queryFn: async () => await getSearchResults(query),
  });

export const draftBillsQuery = () =>
  queryOptions({
    queryKey: ["drafts"],
    queryFn: async () => await listDraftBills(),
  });

export const draftBillQuery = (slug: string) =>
  queryOptions({
    queryKey: ["drafts", slug],
    queryFn: async () => await getDraftBill(slug),
  });

export const draftTextQuery = (slug: string, id: string) =>
  queryOptions({
    queryKey: ["drafts", slug, id],
    queryFn: async () => await getDraftText(slug, id),
  });
