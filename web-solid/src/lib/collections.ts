import { GET } from "@solidjs/web/server-functions";
import * as v from "valibot";

import { readCatalog } from "../server/records/catalog.ts";
import {
  readCollectionVersions,
  readVersionPair,
} from "../server/records/collection-comparison.ts";
import { readCollectionTimeline } from "../server/records/collection-timeline.ts";
import { readCollectionVersion } from "../server/records/collection-version.ts";
import { compareVersions, pickPair } from "./collection-compare.ts";
import { collectionCompare, collectionVersion, slug } from "./schemas.ts";

export const getCollections = GET(async () => {
  "use server";

  const catalog = await readCatalog();
  const laws = new Map(catalog.laws.map((law) => [law.id, law]));

  return catalog.koleksi.map((group) => {
    const baseId = group.mem.find(([, role]) => role === "pokok")?.[0];
    const base = baseId === undefined ? undefined : laws.get(baseId);

    return {
      ...group,
      cite: base?.c ?? baseId ?? "",
      year: base?.y ?? 0,
      laws: group.mem.filter(([, role]) => role !== "digantikan").length,
    };
  });
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

    const merged = await readCollectionVersion(collectionSlug, version);

    const timeline =
      merged === null && version === "latest"
        ? await readCollectionTimeline(collectionSlug)
        : null;

    if (merged === null && timeline === null) {
      return null;
    }

    return {
      name: collection.name,
      named: collection.named,
      title: collection.t,
      path: version === "latest" ? collection.u : `${collection.u}${version}/`,
      merged,
      timeline,
    };
  }
);

export const getCollectionComparison = GET(
  async (
    collectionSlug: string,
    pair: v.InferInput<typeof collectionCompare>
  ) => {
    "use server";

    if (!v.is(slug, collectionSlug)) {
      return null;
    }

    const versions = await readCollectionVersions(collectionSlug);

    if (versions === null) {
      return null;
    }

    const choice = v.safeParse(collectionCompare, pair);

    const selection = choice.success
      ? pickPair(
          versions.map((version) => version.id),
          choice.output.bandingkan,
          choice.output.dari
        )
      : { unknown: true, pair: undefined };

    const record =
      selection.pair === undefined
        ? null
        : await readVersionPair(
            collectionSlug,
            versions[selection.pair[0]].id,
            versions[selection.pair[1]].id
          );

    return compareVersions(versions, selection, record);
  }
);

export type CollectionComparisonView = NonNullable<
  Awaited<ReturnType<typeof getCollectionComparison>>
>;

export type Collection = NonNullable<Awaited<ReturnType<typeof getCollection>>>;
