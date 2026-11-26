import { GET } from "@solidjs/web/server-functions";
import * as v from "valibot";

import { readCatalog } from "../server/records/catalog.ts";
import { searchText } from "./schemas.ts";
import { searchMatches } from "./search-matches.ts";

export const getSearchResults = GET(async (query: string) => {
  "use server";
  const cleaned = v.parse(searchText, query);

  const catalog =
    cleaned === "" ? undefined : searchMatches(cleaned, await readCatalog());

  return { catalog, query: cleaned };
});
