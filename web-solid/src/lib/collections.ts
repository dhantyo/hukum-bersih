import { GET } from "@solidjs/web/server-functions";

import { readCatalog } from "../server/catalog";
import { readCollectionVersion } from "../server/collection-version";

export const getCollections = GET(async () => {
  "use server";

  return (await readCatalog()).koleksi;
});

export const getCollection = GET(async (slug: string, version = "latest") => {
  "use server";

  if (typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug)) {
    return null;
  }

  if (
    typeof version !== "string" ||
    !/^(?:latest|\d{4}-\d{2}-\d{2})$/.test(version)
  ) {
    return null;
  }

  const catalog = await readCatalog();
  const collection = catalog.koleksi.find((group) => group.slug === slug);

  if (!collection) {
    return null;
  }

  const laws = new Map(catalog.laws.map((law) => [law.id, law]));

  const members = collection.mem.map(([id, role]) => ({
    id,
    role,
    law: laws.get(id),
  }));

  const merged = await readCollectionVersion(slug, version);

  if (!merged && version !== "latest") {
    return null;
  }

  return { name: collection.name, title: collection.t, members, merged };
});
