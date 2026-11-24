import * as v from "valibot";

import { internalLink, lawPath, webLink } from "../../lib/schemas.ts";
import { readActiveReleaseText } from "../corpus.ts";
import { parseRecord } from "./parse.ts";
import { readerText } from "./reader-text.ts";

const change = v.object({
  anchor: v.string(),
  num: v.string(),
  kind: v.picklist(["diubah", "disisipkan", "dihapus"]),
  missingBefore: v.boolean(),
  missingAfter: v.boolean(),
  before: v.nullable(v.string()),
  after: v.nullable(v.string()),
});

const amendment = v.object({
  id: v.string(),
  label: v.string(),
  href: v.optional(internalLink),
  date: v.nullable(v.string()),
  gap: v.pipe(v.number(), v.integer(), v.minValue(0)),
  instructions: v.array(v.string()),
  changes: v.array(change),
});

const law = v.object({
  path: lawPath,
  title: v.string(),
  subject: v.string(),
  shortName: v.optional(v.string()),
  source: webLink,
  pdf: v.nullable(webLink),
  archive: v.optional(webLink),
  text: v.nullable(readerText),
  amendments: v.array(amendment),
});

type LawRecord = v.InferOutput<typeof law>;

export type Amendment = LawRecord["amendments"][number];

export const parseLawRecord = (text: string, path: string) => {
  const record = parseRecord(law, text, `law at ${path}`);

  if (record.path !== path) {
    throw new Error(
      `Invalid published law at ${path}: it describes ${record.path}`
    );
  }

  return record;
};

export const readLaw = async (path: string) => {
  const text = await readActiveReleaseText(`laws${path}index.json`);

  return text === null ? null : parseLawRecord(text, path);
};

export const toReaderLaw = (record: LawRecord) => ({
  title: record.title,
  hasAmendments: record.amendments.length > 0,
  subject: record.subject,
  shortName: record.shortName,
  source: record.source,
  pdf: record.pdf,
  archive: record.archive,
  text: record.text,
});

export type ReaderLaw = ReturnType<typeof toReaderLaw>;

export const toComparison = (record: LawRecord) =>
  record.shortName === undefined
    ? { path: record.path, title: record.title, amendments: record.amendments }
    : {
        path: record.path,
        title: record.title,
        shortName: record.shortName,
        amendments: record.amendments,
      };

export type Comparison = ReturnType<typeof toComparison>;
