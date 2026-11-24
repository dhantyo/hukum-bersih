import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import * as v from "valibot";

import { draftDocumentId, slug } from "../src/lib/schemas.ts";
import { data, fromInvocation } from "./astro-data.ts";
import { readerText } from "./reader-text.ts";

type Draft = ReturnType<typeof data.loadRuus>[number];

const [stage] = process.argv.slice(2);

if (stage === undefined) {
  throw new Error("Use pnpm run export-drafts <release-directory>.");
}

const root = fromInvocation(stage, "drafts");

const documentMetadata = (document: Draft["documents"][number]) => {
  const {
    id,
    type,
    label,
    date,
    provenance,
    obtained_by,
    source_url,
    archive_url,
    note,
    ruu_title,
  } = document;

  return {
    id,
    type,
    label,
    date,
    provenance,
    obtained_by,
    source_url,
    archive_url,
    note,
    ruu_title,
    hasText: Boolean(document.text),
  };
};

const exportDraft = (bill: Draft) => {
  const directory = path.join(root, v.parse(slug, bill.slug));
  mkdirSync(path.join(directory, "documents"), { recursive: true });
  const name = bill.short_name ?? bill.title;

  const record = {
    ...bill,
    name,
    documents: bill.documents.map(documentMetadata),
  };

  writeFileSync(path.join(directory, "index.json"), JSON.stringify(record));

  for (const document of data.versions(bill)) {
    const exported = {
      name,
      title: bill.title,
      document: documentMetadata(document),
      text: readerText(data.loadText(bill, document)),
    };

    writeFileSync(
      path.join(
        directory,
        "documents",
        `${v.parse(draftDocumentId, document.id)}.json`
      ),
      JSON.stringify(exported)
    );
  }
};

for (const bill of data.loadRuus()) {
  exportDraft(bill);
}
