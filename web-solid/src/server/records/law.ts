import * as v from "valibot";

import { internalLink, lawPath, webLink } from "../../lib/schemas.ts";
import { readActiveReleaseText } from "../corpus.ts";
import { parseRecord } from "./parse.ts";
import { readerText } from "./reader-text.ts";

const lawText = v.nullable(readerText);
const maybeText = v.optional(v.string());
const href = v.optional(internalLink);
const link = v.object({ label: v.string(), href });

const note = v.object({ label: v.string(), href, by: maybeText });

const version = v.object({
  kind: v.picklist(["point", "missing"]),
  label: v.string(),
  sub: maybeText,
  date: v.nullable(v.string()),
  href,
  inForce: v.boolean(),
  here: v.boolean(),
  made: v.boolean(),
});

const step = v.object({
  kind: v.picklist([
    "pendahulu",
    "pokok",
    "perubahan",
    "ditetapkan-dari",
    "missing",
  ]),
  label: v.string(),
  title: maybeText,
  here: v.optional(v.boolean()),
  href,
  order: v.optional(v.string()),
});

const family = v.object({
  slug: v.string(),
  name: v.string(),
  named: v.boolean(),
  isBase: v.boolean(),
  role: v.string(),
  versions: v.array(version),
  latestHref: href,
  comparable: v.boolean(),
  steps: v.array(step),
});

const law = v.object({
  path: lawPath,
  title: v.string(),
  subject: v.string(),
  shortName: maybeText,
  cite: v.string(),
  year: v.number(),
  status: v.nullish(v.string()),
  statusLabel: v.nullish(v.string()),
  date: v.nullable(v.string()),
  place: v.nullable(v.string()),
  official: v.nullable(v.string()),
  initiator: v.nullable(v.string()),
  pasalCount: v.optional(v.number()),
  amendmentCount: v.number(),
  source: webLink,
  sourceName: v.string(),
  pdf: v.nullable(webLink),
  archive: v.optional(webLink),
  text: lawText,
  missingText: v.optional(v.picklist(["ocr", "unparsed", "pending"])),
  revokedBy: v.array(
    v.object({ ...link.entries, date: v.nullable(v.string()) })
  ),
  relations: v.array(
    v.object({
      ...link.entries,
      verb: v.string(),
      count: v.number(),
      history: v.boolean(),
    })
  ),
  notes: v.record(v.string(), v.array(note)),
  family: v.optional(family),
});

export type LawRecord = v.InferOutput<typeof law>;

export type Family = NonNullable<LawRecord["family"]>;

export type PasalNote = v.InferOutput<typeof note>;

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
