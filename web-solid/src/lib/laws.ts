import { GET } from "@solidjs/web/server-functions";
import * as v from "valibot";

import { readLaw, toComparison, toReaderLaw } from "../server/records/law.ts";
import {
  readLawOverview,
  readYearListing,
} from "../server/records/listings.ts";
import { lawPath, year } from "./schemas.ts";

export const getLawOverview = GET(async () => {
  "use server";

  return await readLawOverview();
});

export const getLawYear = GET(async (lawYear: string) => {
  "use server";

  return v.is(year, lawYear) ? await readYearListing(lawYear) : null;
});

export const getLaw = GET(
  async (path: string, compareTo?: string, compareFrom?: string) => {
    "use server";

    if (!v.is(lawPath, path)) {
      return null;
    }

    const record = await readLaw(path);

    if (record === null) {
      return null;
    }

    const law = toReaderLaw(record);

    if (compareTo === undefined) {
      return { law };
    }

    if (!law.hasAmendments || compareFrom !== undefined) {
      return { law, comparisonRequested: true };
    }

    const amendment =
      compareTo === ""
        ? record.amendments.at(-1)
        : record.amendments.find((entry) => entry.id === compareTo);

    return { law, amendment, comparisonRequested: true };
  }
);

export const getLawComparison = GET(async (path: string) => {
  "use server";

  if (!v.is(lawPath, path)) {
    return null;
  }

  const record = await readLaw(path);

  return record === null || record.amendments.length === 0
    ? null
    : toComparison(record);
});
