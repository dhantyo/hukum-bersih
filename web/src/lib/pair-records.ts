import * as v from "valibot";

import { diffLine } from "./diff-line.ts";

export const comparedVersion = v.object({
  id: v.string(),
  label: v.string(),
  cite: v.string(),
  date: v.nullable(v.string()),
  gap: v.number(),
});

export const versionList = v.object({ versions: v.array(comparedVersion) });

const state = v.picklist(["text", "deleted", "unreadable", "absent"]);

const pasal = v.object({
  num: v.string(),
  before: state,
  after: state,
  lines: v.array(diffLine),
  numbered: v.optional(v.array(diffLine)),
});

export const versionPair = v.object({ pasal: v.array(pasal) });

export type CollectionVersions = v.InferOutput<typeof versionList>["versions"];

export type VersionPair = v.InferOutput<typeof versionPair>;

export type PairPasal = VersionPair["pasal"][number];

export type PasalState = PairPasal["before"];
