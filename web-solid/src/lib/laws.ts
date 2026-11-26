import { GET } from "@solidjs/web/server-functions";
import * as v from "valibot";

import { readComparison } from "../server/comparison.ts";
import { readLaw } from "../server/records/law.ts";
import {
  readLawOverview,
  readYearListing,
} from "../server/records/listings.ts";
import { placeInText } from "./compare.ts";
import type { CompareRequest } from "./compare.ts";
import { lawPath, year } from "./schemas.ts";

export const getLawOverview = GET(async () => {
  "use server";

  return await readLawOverview();
});

export const getLawYear = GET(async (lawYear: string) => {
  "use server";

  return v.is(year, lawYear) ? await readYearListing(lawYear) : null;
});

export const getLaw = GET(async (path: string, request?: CompareRequest) => {
  "use server";

  if (!v.is(lawPath, path)) {
    return null;
  }

  const law = await readLaw(path);

  if (law === null) {
    return null;
  }

  if (
    request?.v === undefined ||
    law.family?.comparable !== true ||
    law.text === null
  ) {
    return { law };
  }

  const comparison = await readComparison(law.family.slug, request);

  return {
    law,
    comparison:
      comparison === null ? undefined : placeInText(comparison, law.text),
  };
});
