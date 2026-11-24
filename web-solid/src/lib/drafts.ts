import { GET } from "@solidjs/web/server-functions";
import * as v from "valibot";

import { readDraftComparison } from "../server/records/draft-comparison.ts";
import { readDraftBill, readDraftText } from "../server/records/draft.ts";
import { readDraftListings } from "../server/records/listings.ts";
import { draftDocumentId, draftPair, slug } from "./schemas.ts";

export const listDraftBills = GET(async () => {
  "use server";

  return await readDraftListings();
});

export const getDraftBill = GET(async (billSlug: string) => {
  "use server";

  return v.is(slug, billSlug) ? await readDraftBill(billSlug) : null;
});

export const getDraftText = GET(async (billSlug: string, id: string) => {
  "use server";

  if (!v.is(slug, billSlug) || !v.is(draftDocumentId, id)) {
    return null;
  }

  return await readDraftText(billSlug, id);
});

export const getDraftComparison = GET(
  async (billSlug: string, pair: string) => {
    "use server";

    if (!v.is(slug, billSlug) || !v.is(draftPair, pair)) {
      return null;
    }

    return await readDraftComparison(billSlug, pair);
  }
);
