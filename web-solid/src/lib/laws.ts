import { GET } from "@solidjs/web/server-functions";
import * as v from "valibot";

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

export const getLaw = GET(async (path: string) => {
  "use server";

  return v.is(lawPath, path) ? await readLaw(path) : null;
});
