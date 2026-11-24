import * as v from "valibot";

import { internalLink } from "../../lib/schemas.ts";
import { readActiveReleaseText } from "../corpus.ts";
import { parseRecord } from "./parse.ts";
import { readerText } from "./reader-text.ts";

const collectionVersion = v.object({
  date: v.nullable(v.string()),
  base: v.object({ label: v.string(), href: internalLink }),
  amendments: v.array(v.string()),
  versions: v.array(
    v.object({
      label: v.string(),
      date: v.nullable(v.string()),
      href: v.optional(internalLink),
      sub: v.optional(v.string()),
    })
  ),
  incomplete: v.boolean(),
  missing: v.number(),
  unreadable: v.array(v.string()),
  unapplied: v.array(v.string()),
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
