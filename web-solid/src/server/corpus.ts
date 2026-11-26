import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getRequestEvent } from "@solidjs/web";
import * as v from "valibot";

import { releaseId } from "../lib/schemas.ts";
import { isPresent } from "../lib/text.ts";

interface CorpusObject {
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
  /** The bytes as a stream, to pass on without reading them. */
  body: ReadableStream<Uint8Array> | null;
  /** A strong, quoted entity tag of the bytes. */
  httpEtag: string;
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

const fileObject = (bytes: Buffer<ArrayBuffer>) => {
  const response = new Response(bytes);

  return {
    text: async () => await response.text(),
    arrayBuffer: async () => await response.arrayBuffer(),
    body: response.body,
    get httpEtag() {
      return `"${createHash("sha256").update(bytes).digest("hex")}"`;
    },
  } satisfies CorpusObject;
};

const readCorpusObject = async (key: string) => {
  const bucket = getRequestEvent()?.locals.corpus;

  if (bucket) {
    return await bucket.get(key);
  }

  const directory = process.env.HUKUM_CORPUS_DIR;

  if (!isPresent(directory)) {
    throw new Error("The published corpus is unavailable");
  }

  try {
    return fileObject(await readFile(path.join(directory, key)));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
};

const loadActiveRelease = async () => {
  const pointer = await readCorpusObject("active-release");
  const pointerText = await pointer?.text();
  const release = pointerText?.trim();

  if (!isPresent(release) || !v.is(releaseId, release)) {
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
