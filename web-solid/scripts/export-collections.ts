import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import * as v from "valibot";

import { collectionVersion, slug } from "../src/lib/schemas.ts";
import { isPresent } from "../src/lib/text.ts";
import {
  amendments,
  fromInvocation,
  koleksi,
  merge,
  peraturan,
  versions,
} from "./astro-data.ts";
import { readerText } from "./reader-text.ts";

type Collection = ReturnType<typeof koleksi.loadKoleksi>[number];

type Merged = NonNullable<ReturnType<typeof merge.mergedDoc>>;

type VersionRows = ReturnType<typeof versions.versionRows>;

const [stage] = process.argv.slice(2);

if (stage === undefined) {
  throw new Error("Use pnpm run export-collections <release-directory>.");
}

const root = fromInvocation(stage, "collections");

const mergedRecord = (
  collection: Collection,
  merged: Merged,
  rows: VersionRows
) => {
  const { point, doc, unreadable, notes } = merged;

  return {
    date: point.date,
    base: {
      label: peraturan.citeId(collection.base.id),
      href: `/${peraturan.lawPath(collection.base)}`,
    },
    amendments: (point.after ?? []).map(peraturan.citeId),
    versions: rows.map(({ label, date, href, sub }) => ({
      label,
      date,
      href,
      sub,
    })),
    incomplete: point.complete === false || unreadable.size > 0,
    missing: point.missing_before ?? 0,
    unreadable: [...unreadable],
    unapplied: (point.not_applied ?? [])
      .filter((entry) => entry.affects_wording)
      .map((entry) => entry.header),
    notes: Object.fromEntries(notes),
    text: readerText(doc),
  };
};

const writeJson = (directory: string, name: string, json: string) => {
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, `${name}.json`), json);
};

const exportCollection = (collection: Collection, directory: string) => {
  const document = peraturan.loadRegulationText(collection.base);

  if (!document) {
    return;
  }

  if (amendments.hasAmendmentSteps(collection.base)) {
    const comparison = amendments.compareData(
      amendments.versionHistory(collection.base, document)
    );

    writeJson(directory, "perubahan", JSON.stringify(comparison));
  }

  const points = versions.historyOf(collection.base)?.points ?? [];
  const latest = points.at(-1);
  const rows = versions.versionRows(collection);

  for (const point of points) {
    if (
      point.kind !== "gabungan" ||
      (point !== latest && !isPresent(point.date))
    ) {
      continue;
    }

    const merged = merge.mergedDoc(collection, point.id);

    if (!merged) {
      continue;
    }

    const name = v.parse(
      collectionVersion,
      point === latest ? "latest" : point.date
    );

    writeJson(
      directory,
      name,
      JSON.stringify(mergedRecord(collection, merged, rows))
    );
  }
};

for (const collection of koleksi.loadKoleksi()) {
  const collectionSlug = v.parse(slug, collection.slug);

  exportCollection(collection, path.join(root, collectionSlug));
}
