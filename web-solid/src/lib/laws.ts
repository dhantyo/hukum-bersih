import { GET } from "@solidjs/web/server-functions";
import * as v from "valibot";

import { readCatalog } from "../server/records/catalog.ts";
import { readLaw, toComparison, toReaderLaw } from "../server/records/law.ts";
import { lawPath, year } from "./schemas.ts";

const readLawCatalog = async () => {
  const { laws } = await readCatalog();

  return laws.filter((law) => v.is(lawPath, law.u));
};

export const getLawOverview = GET(async () => {
  "use server";
  const laws = await readLawCatalog();
  const years = Map.groupBy(laws, (law) => law.y);

  return {
    total: laws.length,
    years: [...years].map(([lawYear, items]) => ({
      year: lawYear,
      count: items.length,
    })),
    recent: laws.slice(0, 20),
  };
});

export const getLawYear = GET(async (lawYear: string) => {
  "use server";

  if (!v.is(year, lawYear)) {
    return [];
  }

  return (await readLawCatalog()).filter((law) => law.y === Number(lawYear));
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
