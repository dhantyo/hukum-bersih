import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { getRequestEvent } from "@solidjs/web";

interface CorpusObject {
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export interface CorpusBucket {
  get: (key: string) => Promise<CorpusObject | null>;
}

declare module "@solidjs/web" {
  interface RequestEventLocals {
    corpus?: CorpusBucket;
    activeCorpusRelease?: Promise<string>;
  }
}

const readCorpusObject = async (key: string) => {
  const bucket = getRequestEvent()?.locals.corpus;

  if (bucket) {
    return await bucket.get(key);
  }

  const directory = process.env.HUKUM_CORPUS_DIR;

  if (!directory) {
    throw new Error("The published corpus is unavailable");
  }

  try {
    return new Response(await readFile(join(directory, key)));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
};

export const releaseIdPattern = /^[a-z0-9][a-z0-9-]{0,63}$/u;

const loadActiveRelease = async () => {
  const pointer = await readCorpusObject("active-release");
  const release = (await pointer?.text())?.trim();

  if (!release || !releaseIdPattern.test(release)) {
    throw new Error("The corpus has no valid active release");
  }

  return release;
};

export const readActiveRelease = async () => {
  const locals = getRequestEvent()?.locals;

  return locals
    ? await (locals.activeCorpusRelease ??= loadActiveRelease())
    : await loadActiveRelease();
};

export const readReleaseObject = async (release: string, key: string) =>
  await readCorpusObject(`releases/${release}/${key}`);

export const readActiveReleaseText = async (key: string) => {
  const object = await readReleaseObject(await readActiveRelease(), key);

  return object === null ? null : await object.text();
};
