import * as v from "valibot";

import { isLawText } from "../law-record";
import type { LawText } from "../law-record";
import { readActiveRelease, readReleaseObject } from "./corpus";

const internalLink = v.pipe(
  v.string(),
  v.regex(
    /^\/(?:[a-z-]+\/[a-z0-9]+\/\d{4}|koleksi\/[a-z0-9-]+(?:\/\d{4}-\d{2}-\d{2})?)\/$/
  )
);

const mergedVersion = v.object({
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
  text: v.custom<LawText>(isLawText),
});

export type MergedVersion = v.InferOutput<typeof mergedVersion>;

export async function readCollectionVersion(slug: string, version: string) {
  const release = await readActiveRelease();

  const file = await readReleaseObject(
    release,
    `collections/${slug}/${version}.json`
  );

  return file ? v.parse(mergedVersion, JSON.parse(await file.text())) : null;
}
