import * as v from "valibot";

import { parseRecord } from "../../lib/parse-record.ts";
import { internalLink } from "../../lib/schemas.ts";
import { readActiveRelease, readActiveReleaseText } from "../corpus.ts";

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

export type CatalogCollection = v.InferOutput<typeof collection>;

export type Catalog = v.InferOutput<typeof catalog>;

const readCatalogText = async () => {
  const text = await readActiveReleaseText("law-catalog.json");

  if (text === null) {
    throw new Error("The active release has no law catalog");
  }

  return text;
};

interface LoadedCatalog {
  text: string;
  catalog: Catalog;
}

let loaded: { release: string; value: Promise<LoadedCatalog> } | undefined;

const loadCatalog = async () => {
  try {
    const text = await readCatalogText();

    return { text, catalog: parseRecord(catalog, text, "law catalog") };
  } catch (error) {
    loaded = undefined;
    throw error;
  }
};

const readLoadedCatalog = async () => {
  const release = await readActiveRelease();

  if (loaded?.release !== release) {
    loaded = { release, value: loadCatalog() };
  }

  return await loaded.value;
};

export const readCatalog = async () => {
  const { catalog: parsed } = await readLoadedCatalog();

  return parsed;
};

export const readCatalogJson = async () => {
  const { text } = await readLoadedCatalog();

  return text;
};
