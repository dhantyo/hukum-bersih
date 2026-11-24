import { GET } from "@solidjs/web/server-functions";
import * as v from "valibot";

import { compareVersions } from "../server/law-comparison.ts";
import { readCollectionComparison } from "../server/records/collection-comparison.ts";
import { readLaw } from "../server/records/law.ts";
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

    const law = await readLaw(path);

    if (law === null) {
      return null;
    }

    if (
      compareTo === undefined ||
      law.family?.comparable !== true ||
      law.text === null
    ) {
      return { law };
    }

    const data = await readCollectionComparison(law.family.slug);

    return {
      law,
      comparison:
        data === null
          ? undefined
          : compareVersions(data, law.text, compareTo, compareFrom),
    };
  }
);

export const getLawPerubahan = GET(async (path: string) => {
  "use server";

  if (!v.is(lawPath, path)) {
    return null;
  }

  const law = await readLaw(path);

  return law === null ? null : { target: law.perubahanTarget };
});
