import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import * as v from "valibot";

import { collectionVersion, slug } from "../src/lib/schemas.ts";
import { isPresent } from "../src/lib/text.ts";
import {
  amendments,
  koleksi,
  merge,
  peraturan,
  versions,
} from "./astro-data.ts";
import { statusOf, timelineRecord } from "./collection-timeline.ts";
import { readerText } from "./reader-text.ts";

type Collection = ReturnType<typeof koleksi.loadKoleksi>[number];

type Merged = NonNullable<ReturnType<typeof merge.mergedDoc>>;

type VersionRows = ReturnType<typeof versions.versionRows>;

const lawLink = (id: string) => {
  const lawPath = peraturan.pathOf(id);

  return lawPath === undefined ? undefined : `/${lawPath}`;
};

const citation = (id: string) => ({
  label: peraturan.citeId(id),
  href: lawLink(id),
});

const factLabels = {
  pokok: () => "Undang-undang pokok",
  perubahan: (order?: number) =>
    order === undefined || order === 0 ? "Perubahan" : `Perubahan ke-${order}`,
  pendahulu: () => "Menggantikan",
  lain: () => "Terkait",
};

const factOrder = ["pokok", "perubahan", "pendahulu", "lain"] as const;

const factsOf = (collection: Collection) =>
  factOrder.flatMap((role) =>
    koleksi
      .members(collection)
      .filter((member) => member.role === role)
      .map(({ law, order }) => {
        const { label, href } = citation(law.id);

        return { label: factLabels[role](order), value: label, href };
      })
  );

const mergedRecord = (
  collection: Collection,
  merged: Merged,
  rows: VersionRows
) => {
  const { point, doc, unreadable, notes } = merged;

  return {
    date: point.date,
    title: collection.named
      ? collection.name
      : collection.base.subject || collection.base.title,
    baseTitle: collection.base.title,
    status: statusOf(collection.base.status) ?? null,
    amended: koleksi.amendments(collection),
    base: {
      label: peraturan.citeId(collection.base.id),
      href: `/${peraturan.lawPath(collection.base)}`,
    },
    amendments: (point.after ?? []).map(citation),
    facts: factsOf(collection),
    versions: rows.map(({ kind, label, date, href, sub, inForce }) => ({
      label,
      date,
      href,
      sub,
      missing: kind === "missing",
      inForce,
    })),
    incomplete: point.complete === false || unreadable.size > 0,
    missing: point.missing_before ?? 0,
    unreadable: [...unreadable],
    unapplied: (point.not_applied ?? [])
      .filter((entry) => entry.affects_wording)
      .map((entry) => ({
        header: entry.header,
        instruction: entry.instruction,
        by: citation(entry.by),
      })),
    notes: Object.fromEntries(notes),
    text: readerText(doc),
  };
};

const writeJson = (directory: string, name: string, json: string) => {
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, `${name}.json`), json);
};

type Document = NonNullable<ReturnType<typeof peraturan.loadRegulationText>>;

const exportText = (
  collection: Collection,
  document: Document,
  directory: string
) => {
  if (amendments.hasAmendmentSteps(collection.base)) {
    const comparison = amendments.compareData(
      amendments.versionHistory(collection.base, document)
    );

    writeJson(directory, "perubahan", JSON.stringify(comparison));
  }

  const points = versions.historyOf(collection.base)?.points ?? [];
  const latest = points.at(-1);
  const rows = versions.versionRows(collection);
  let wroteLatest = false;

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

    wroteLatest ||= point === latest;
  }

  return wroteLatest;
};

const exportCollection = (collection: Collection, directory: string) => {
  const document = peraturan.loadRegulationText(collection.base);

  if (document && exportText(collection, document, directory)) {
    return;
  }

  writeJson(
    directory,
    "timeline",
    JSON.stringify(timelineRecord(collection, document))
  );
};

export const exportCollections = (stage: string) => {
  for (const collection of koleksi.loadKoleksi()) {
    const collectionSlug = v.parse(slug, collection.slug);

    exportCollection(
      collection,
      path.join(stage, "collections", collectionSlug)
    );
  }
};
