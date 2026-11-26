import { query } from "@solidjs/router";

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

const fetchReader = async (path: string, request: CompareRequest) =>
  request.v === undefined ? await getLaw(path) : await getLaw(path, request);

export const readerQuery = query(fetchReader, "reader");
export const overviewQuery = query(getLawOverview, "overview");
export const yearQuery = query(getLawYear, "year");
export const collectionsQuery = query(getCollections, "collections");
export const collectionQuery = query(getCollection, "collection");

export const collectionComparisonQuery = query(
  getCollectionComparison,
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
