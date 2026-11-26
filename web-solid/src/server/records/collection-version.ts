import * as v from "valibot";

import { parseRecord } from "../../lib/parse-record.ts";
import { internalLink } from "../../lib/schemas.ts";
import { readActiveReleaseText } from "../corpus.ts";
import { readerText } from "./reader-text.ts";

const citation = v.object({
  label: v.string(),
  href: v.optional(internalLink),
});

const collectionVersion = v.object({
  date: v.nullable(v.string()),
  title: v.string(),
  baseTitle: v.string(),
  status: v.nullable(v.object({ key: v.string(), label: v.string() })),
  amended: v.number(),
  base: v.object({ label: v.string(), href: internalLink }),
  amendments: v.array(citation),
  facts: v.array(
    v.object({
      label: v.string(),
      value: v.string(),
      href: v.optional(internalLink),
    })
  ),
  versions: v.array(
    v.object({
      label: v.string(),
      date: v.nullable(v.string()),
      href: v.optional(internalLink),
      sub: v.optional(v.string()),
      missing: v.boolean(),
      inForce: v.boolean(),
    })
  ),
  incomplete: v.boolean(),
  missing: v.number(),
  unreadable: v.array(v.string()),
  unapplied: v.array(
    v.object({
      header: v.string(),
      instruction: v.nullable(v.number()),
      by: citation,
    })
  ),
  notes: v.record(
    v.string(),
    v.array(
      v.object({
        kind: v.picklist(["diubah", "disisipkan", "dihapus", "unreadable"]),
        label: v.string(),
        href: v.optional(internalLink),
        by: v.string(),
      })
    )
  ),
  text: readerText,
});

export type CollectionVersion = v.InferOutput<typeof collectionVersion>;

export const readCollectionVersion = async (slug: string, version: string) => {
  const text = await readActiveReleaseText(
    `collections/${slug}/${version}.json`
  );

  return text === null
    ? null
    : parseRecord(collectionVersion, text, `collection ${slug}/${version}`);
};
