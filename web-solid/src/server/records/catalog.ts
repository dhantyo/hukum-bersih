import * as v from "valibot";

import { internalLink } from "../../lib/schemas.ts";
import { readActiveReleaseText } from "../corpus.ts";
import { parseRecord } from "./parse.ts";

const entry = v.object({
  id: v.string(),
  s: v.nullable(v.string()),
  c: v.string(),
  t: v.string(),
  n: v.string(),
  y: v.number(),
  st: v.optional(v.nullable(v.string())),
  m: v.array(v.string()),
  k: v.number(),
  u: internalLink,
});

const collection = v.object({
  slug: v.string(),
  name: v.string(),
  named: v.boolean(),
  t: v.string(),
  a: v.array(v.string()),
  k: v.number(),
  u: internalLink,
  mem: v.array(v.tuple([v.string(), v.string()])),
});

const catalog = v.object({
  laws: v.array(entry),
  koleksi: v.array(collection),
});

export type LawCatalogEntry = v.InferOutput<typeof entry>;

export type Catalog = v.InferOutput<typeof catalog>;

const readCatalogText = async () => {
  const text = await readActiveReleaseText("law-catalog.json");

  if (text === null) {
    throw new Error("The active release has no law catalog");
  }

  return text;
};

export const readCatalog = async () =>
  parseRecord(catalog, await readCatalogText(), "law catalog");

export const readCatalogJson = async () => {
  const text = await readCatalogText();
  parseRecord(catalog, text, "law catalog");

  return text;
};
