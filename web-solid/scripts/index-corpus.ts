import { glob, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

import * as pagefind from "pagefind";

import { draftDocumentTitle, lawHeading } from "../src/lib/titles.ts";
import { parseDraftText } from "../src/server/records/draft.ts";
import { parseLawRecord } from "../src/server/records/law.ts";
import { textRecords } from "./search-records.ts";
import type { SearchRecord } from "./search-records.ts";

const FRAGMENT_FILE_LIMIT = 2000;

interface Counts {
  pages: number;
  records: number;
}

const addRecords = async (
  index: pagefind.PagefindIndex,
  records: SearchRecord[]
) => {
  const added = await Promise.all(
    records.map(async (record) => await index.addCustomRecord(record))
  );

  const errors = added.flatMap((result) => result.errors);

  if (errors.length > 0) {
    throw new Error(`Pagefind rejected a record: ${errors[0]}`);
  }
};

const indexLaws = async (index: pagefind.PagefindIndex, stage: string) => {
  const counts: Counts = { pages: 0, records: 0 };

  const root = path.join(stage, "laws");

  for await (const file of glob("uu/*/*/index.json", { cwd: root })) {
    const page = `/${file.slice(0, -"index.json".length)}`;

    const law = parseLawRecord(
      await readFile(path.join(root, file), "utf-8"),
      page
    );

    if (law.text !== null) {
      const records = textRecords(page, lawHeading(law), law.text);
      await addRecords(index, records);
      counts.pages += 1;
      counts.records += records.length;
    }
  }

  return counts;
};

const indexDrafts = async (index: pagefind.PagefindIndex, stage: string) => {
  const counts: Counts = { pages: 0, records: 0 };

  for await (const file of glob("drafts/*/documents/*.json", { cwd: stage })) {
    const [, slug, , name] = file.split("/");
    const id = name.slice(0, -".json".length);

    const draft = parseDraftText(
      await readFile(path.join(stage, file), "utf-8"),
      slug,
      id
    );

    const records = textRecords(
      `/ruu/${slug}/${id}/`,
      draftDocumentTitle(draft.document),
      draft.text
    );

    await addRecords(index, records);
    counts.pages += 1;
    counts.records += records.length;
  }

  return counts;
};

export const indexCorpus = async (stage: string) => {
  const { index, errors } = await pagefind.createIndex({
    maxFragments: FRAGMENT_FILE_LIMIT,
  });

  if (index === undefined) {
    throw new Error(`Could not start Pagefind: ${errors.join("; ")}`);
  }

  const scratch = await mkdtemp(path.join(path.resolve(stage), ".pagefind-"));

  try {
    const laws = await indexLaws(index, stage);

    if (laws.pages === 0) {
      throw new Error("The release has no law documents to index");
    }

    const drafts = await indexDrafts(index, stage);
    const written = await index.writeFiles({ outputPath: scratch });

    if (written.errors.length > 0) {
      throw new Error(`Pagefind could not write: ${written.errors.join("; ")}`);
    }

    await rename(scratch, path.resolve(stage, "pagefind"));

    console.log(
      `Indexed ${laws.records + drafts.records} records from ${laws.pages + drafts.pages} documents`
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
    await index.deleteIndex();
    await pagefind.close();
  }
};
