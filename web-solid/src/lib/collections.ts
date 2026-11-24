import { GET } from "@solidjs/web/server-functions";
import * as v from "valibot";

import { readCatalog } from "../server/records/catalog.ts";
import { readCollectionVersion } from "../server/records/collection-version.ts";
import { collectionVersion, slug } from "./schemas.ts";

export const getCollections = GET(async () => {
  "use server";

  return (await readCatalog()).koleksi;
});

export const getCollection = GET(
  async (collectionSlug: string, version = "latest") => {
    "use server";

    if (!v.is(slug, collectionSlug) || !v.is(collectionVersion, version)) {
      return null;
    }

    const catalog = await readCatalog();

    const collection = catalog.koleksi.find(
      (group) => group.slug === collectionSlug
    );

    if (!collection) {
      return null;
    }

    const laws = new Map(catalog.laws.map((law) => [law.id, law]));

    const members = collection.mem.map(([id, role]) => ({
      id,
      role,
      law: laws.get(id),
    }));

    const merged = await readCollectionVersion(collectionSlug, version);

    if (!merged && version !== "latest") {
      return null;
    }

    return { name: collection.name, title: collection.t, members, merged };
  }
);

export type Collection = NonNullable<Awaited<ReturnType<typeof getCollection>>>;
