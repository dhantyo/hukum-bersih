import * as v from "valibot";

import { internalLink } from "./schemas.ts";

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

export const catalog = v.object({
  laws: v.array(entry),
  koleksi: v.array(collection),
});

export type LawCatalogEntry = v.InferOutput<typeof entry>;

export type CatalogCollection = v.InferOutput<typeof collection>;

export type Catalog = v.InferOutput<typeof catalog>;
