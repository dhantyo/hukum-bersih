import { catalog } from "../../lib/catalog-record.ts";
import type { Catalog } from "../../lib/catalog-record.ts";
import { parseRecord } from "../../lib/parse-record.ts";
import { readActiveRelease, readActiveReleaseText } from "../corpus.ts";

const readCatalogText = async () => {
  const text = await readActiveReleaseText("law-catalog.json");

  if (text === null) {
    throw new Error("The active release has no law catalog");
  }

  return text;
};

let loaded: { release: string; value: Promise<Catalog> } | undefined;

const loadCatalog = async () => {
  try {
    return parseRecord(catalog, await readCatalogText(), "law catalog");
  } catch (error) {
    loaded = undefined;
    throw error;
  }
};

export const readCatalog = async () => {
  const release = await readActiveRelease();

  if (loaded?.release !== release) {
    loaded = { release, value: loadCatalog() };
  }

  return await loaded.value;
};
