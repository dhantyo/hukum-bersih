import { query } from "@solidjs/router";
import { isServer } from "@solidjs/web";

import { compareInBrowser } from "./browser-comparison.ts";
import {
  getCollection,
  getCollectionComparison,
  getCollections,
} from "./collections";
import type { CompareRequest } from "./compare.ts";
import {
  getDraftBill,
  getDraftComparison,
  getDraftText,
  listDraftBills,
} from "./drafts";
import { getLaw, getLawOverview, getLawYear } from "./laws";
import { getSearchResults } from "./search";

export const lawQuery = query(getLaw, "law");
export const overviewQuery = query(getLawOverview, "overview");
export const yearQuery = query(getLawYear, "year");
export const collectionsQuery = query(getCollections, "collections");
export const collectionQuery = query(getCollection, "collection");

const fetchComparison = async (slug: string, request: CompareRequest) => {
  if (isServer) {
    return await getCollectionComparison(slug, request);
  }

  return await compareInBrowser(
    slug,
    request,
    async () => await getCollectionComparison(slug, request)
  );
};

export const collectionComparisonQuery = query(
  fetchComparison,
  "collection-comparison"
);

export const searchQuery = query(getSearchResults, "search");
export const draftBillsQuery = query(listDraftBills, "drafts");
export const draftBillQuery = query(getDraftBill, "draft");
export const draftTextQuery = query(getDraftText, "draft-text");

export const draftComparisonQuery = query(
  getDraftComparison,
  "draft-comparison"
);
