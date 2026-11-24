import * as v from "valibot";

import { isLawText } from "../law-record";
import type { LawText } from "../law-record";
import { readActiveRelease, readReleaseObject } from "./corpus";

const webLink = v.pipe(v.string(), v.url(), v.regex(/^https?:\/\//));

const document = v.object({
  id: v.pipe(v.string(), v.regex(/^[a-z0-9_-]+$/)),
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
  documents: v.array(document),
});

const draft = v.object({
  name: v.string(),
  title: v.string(),
  document,
  text: v.custom<LawText>(isLawText),
});

async function readDraftObject(key: string) {
  const file = await readReleaseObject(
    await readActiveRelease(),
    `drafts/${key}`
  );

  return file ? JSON.parse(await file.text()) : null;
}

export type DraftDocument = v.InferOutput<typeof document>;

export async function readDraftBill(slug: string) {
  const record = await readDraftObject(`${slug}/index.json`);

  return record === null ? null : v.parse(bill, record);
}

export async function readDraftText(slug: string, id: string) {
  const record = await readDraftObject(`${slug}/documents/${id}.json`);

  if (record === null) {
    return null;
  }

  const result = v.parse(draft, record);

  if (result.document.id !== id) {
    throw new Error(`Published draft does not match ${slug}/${id}`);
  }

  return result;
}
