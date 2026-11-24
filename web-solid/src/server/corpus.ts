import { getRequestEvent } from '@solidjs/web';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

interface CorpusObject {
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface CorpusBucket {
  get(key: string): Promise<CorpusObject | null>;
}

declare module '@solidjs/web' {
  interface RequestEventLocals {
    corpus?: CorpusBucket;
    activeCorpusRelease?: Promise<string>;
  }
}

async function readCorpusObject(key: string): Promise<CorpusObject | null> {
  const bucket = getRequestEvent()?.locals.corpus;
  if (bucket) return bucket.get(key);
  const directory = process.env.HUKUM_CORPUS_DIR;
  if (!directory) throw new Error('The published corpus is unavailable');
  try {
    return new Response(await readFile(join(directory, key)));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

export const releaseIdPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;

async function loadActiveRelease() {
  const pointer = await readCorpusObject('active-release');
  const release = (await pointer?.text())?.trim();
  if (!release || !releaseIdPattern.test(release)) {
    throw new Error('The corpus has no valid active release');
  }
  return release;
}

export function readActiveRelease() {
  const locals = getRequestEvent()?.locals;
  return locals ? (locals.activeCorpusRelease ??= loadActiveRelease()) : loadActiveRelease();
}

export function readReleaseObject(release: string, key: string) {
  return readCorpusObject(`releases/${release}/${key}`);
}

export async function readLawObject(path: string): Promise<unknown> {
  const document = await readReleaseObject(await readActiveRelease(), `laws${path}index.json`);
  return document === null ? null : JSON.parse(await document.text());
}
