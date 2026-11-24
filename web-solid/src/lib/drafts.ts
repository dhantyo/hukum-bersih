import { GET } from "@solidjs/web/server-functions";

import { readCatalog } from "../server/catalog";
import { readDraftBill, readDraftText } from "../server/draft-record";

function validSlug(slug: unknown): slug is string {
  return typeof slug === "string" && /^[a-z0-9-]+$/.test(slug);
}

export const listDraftBills = GET(async () => {
  "use server";

  return (await readCatalog()).laws.filter((law) => law.c === "RUU");
});

export const getDraftBill = GET(async (slug: string) => {
  "use server";

  return validSlug(slug) ? await readDraftBill(slug) : null;
});

export const getDraftText = GET(async (slug: string, id: string) => {
  "use server";

  if (!validSlug(slug) || typeof id !== "string" || !/^[a-z0-9_-]+$/.test(id)) {
    return null;
  }

  return await readDraftText(slug, id);
});
