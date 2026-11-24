import { query } from "@solidjs/router";

import {
  getCollection,
  getCollectionComparison,
  getCollections,
} from "./collections";
import {
  getDraftBill,
  getDraftComparison,
  getDraftText,
  listDraftBills,
} from "./drafts";
import { getLaw, getLawOverview, getLawPerubahan, getLawYear } from "./laws";
import { getSearchResults } from "./search";

const fetchReader = async (
  path: string,
  compareTo?: string,
  compareFrom?: string
) => {
  if (compareTo === undefined) {
    return await getLaw(path);
  }

  return compareFrom === undefined
    ? await getLaw(path, compareTo)
    : await getLaw(path, compareTo, compareFrom);
};

export const readerQuery = query(fetchReader, "reader");
export const perubahanQuery = query(getLawPerubahan, "perubahan");
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
