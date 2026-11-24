import { GET } from "@solidjs/web/server-functions";
import * as v from "valibot";

import { readActiveRelease } from "../server/corpus.ts";
import { readCatalog } from "../server/records/catalog.ts";
import { searchText } from "./schemas.ts";
import { searchMatches } from "./search-matches.ts";

export const getSearchResults = GET(async (query: string) => {
  "use server";
  const release = await readActiveRelease();
  const cleaned = v.parse(searchText, query);

  const catalog =
    cleaned === "" ? undefined : searchMatches(cleaned, await readCatalog());

  return { release, catalog, query: cleaned };
});
