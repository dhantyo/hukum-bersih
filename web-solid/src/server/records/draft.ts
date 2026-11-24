import * as v from "valibot";

import { draftDocumentId, webLink } from "../../lib/schemas.ts";
import { readActiveReleaseText } from "../corpus.ts";
import { parseRecord } from "./parse.ts";
import { readerText } from "./reader-text.ts";

export const draftDocument = v.object({
  id: draftDocumentId,
  type: v.string(),
  label: v.optional(v.string()),
  date: v.string(),
  provenance: v.nullable(v.picklist(["official", "archive", "media", "leak"])),
  obtained_by: v.optional(v.string()),
  source_url: v.nullable(webLink),
  archive_url: v.optional(webLink),
  note: v.optional(v.string()),
  ruu_title: v.optional(v.string()),
  hasText: v.boolean(),
});

const bill = v.object({
  name: v.string(),
  title: v.string(),
  initiator: v.optional(v.string()),
  dpr_page: v.optional(webLink),
  enacted_as: v.nullable(v.string()),
  former_titles: v.optional(v.array(v.string())),
  stages: v.array(
    v.object({
      stage: v.string(),
      date: v.string(),
      note: v.optional(v.string()),
    })
  ),
  documents: v.array(draftDocument),
});

const draft = v.object({
  name: v.string(),
  title: v.string(),
  document: draftDocument,
  text: readerText,
});

export type DraftBill = v.InferOutput<typeof bill>;

export type DraftDocument = v.InferOutput<typeof draftDocument>;

export const readDraftBill = async (slug: string) => {
  const text = await readActiveReleaseText(`drafts/${slug}/index.json`);

  return text === null ? null : parseRecord(bill, text, `draft bill ${slug}`);
};

export const readDraftText = async (slug: string, id: string) => {
  const text = await readActiveReleaseText(
    `drafts/${slug}/documents/${id}.json`
  );

  if (text === null) {
    return null;
  }

  const record = parseRecord(draft, text, `draft ${slug}/${id}`);

  if (record.document.id !== id) {
    throw new Error(`Published draft does not match ${slug}/${id}`);
  }

  return record;
};
