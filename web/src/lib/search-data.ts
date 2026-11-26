import { isServer } from "@solidjs/web";

import { catalog } from "./catalog-record.ts";
import type { Catalog } from "./catalog-record.ts";
import { loadPagefind } from "./pagefind.ts";
import { parseRecord } from "./parse-record.ts";
import { tokenise } from "./search-matches.ts";
import { isPresent } from "./text.ts";

let loading: Promise<Catalog> | undefined;

export const corpusRelease = () => {
  const release: string = import.meta.env.CORPUS_RELEASE;

  if (!isPresent(release)) {
    throw new Error("This build does not know its corpus release");
  }

  return release;
};

const readCatalog = async () => {
  const url = `/data/${corpusRelease()}/law-catalog.json`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }

  const parsed = parseRecord(catalog, await response.text(), "law catalog");
  tokenise(parsed);

  return parsed;
};

export const loadCatalog = async () => {
  if (loading === undefined) {
    const started = readCatalog();
    loading = started;

    void started.catch(() => {
      loading = undefined;
    });
  }

  return await loading;
};

const warm = async () => {
  try {
    await Promise.all([loadCatalog(), loadPagefind(corpusRelease())]);
  } catch (error) {
    console.error("Search prefetch failed", error);
  }
};

export const prefetchSearch = () => {
  if (!isServer) {
    void warm();
  }
};
