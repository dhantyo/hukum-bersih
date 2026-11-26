import { isServer } from "@solidjs/web";

import { compareColumns, neighbourPairs, selectColumns } from "./compare.ts";
import type {
  CompareRequest,
  PairIds,
  PublishedComparison,
} from "./compare.ts";
import { versionList, versionPair } from "./pair-records.ts";
import type { CollectionVersions, VersionPair } from "./pair-records.ts";
import { parseRecord } from "./parse-record.ts";

const INDEX_FILE = "index";

class MissingFileError extends Error {
  name = "MissingFileError";
}

const versionLists = new Map<string, Promise<CollectionVersions | null>>();
const pairs = new Map<string, Promise<VersionPair>>();
const shown = new Map<string, PublishedComparison>();
let knownRelease: string | undefined;

const fileUrl = (release: string, slug: string, name: string) =>
  `/data/${release}/collections/${slug}/comparisons/${name}.json`;

const fetchText = async (url: string) => {
  const response = await fetch(url);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }

  return await response.text();
};

const once = async <Value>(
  cache: Map<string, Promise<Value>>,
  url: string,
  load: () => Promise<Value>
) => {
  const known = cache.get(url);

  if (known !== undefined) {
    return await known;
  }

  const started = load();

  cache.set(url, started);

  void started.catch(() => {
    cache.delete(url);
  });

  return await started;
};

const loadVersions = async (release: string, slug: string) => {
  const url = fileUrl(release, slug, INDEX_FILE);

  return await once(versionLists, url, async () => {
    const text = await fetchText(url);

    return text === null
      ? null
      : parseRecord(versionList, text, `collection versions ${slug}`).versions;
  });
};

const loadPair = async (
  release: string,
  slug: string,
  [older, newer]: PairIds
) => {
  const url = fileUrl(release, slug, `${older}...${newer}`);

  return await once(pairs, url, async () => {
    const text = await fetchText(url);

    if (text === null) {
      throw new MissingFileError(url);
    }

    return parseRecord(
      versionPair,
      text,
      `version comparison ${slug} ${older}...${newer}`
    );
  });
};

const buildComparison = async (
  release: string,
  slug: string,
  request: CompareRequest
) => {
  const versions = await loadVersions(release, slug);

  if (versions === null) {
    return null;
  }

  const ids = versions.map((version) => version.id);
  const selection = selectColumns(ids, request);

  const loaded = await Promise.all(
    neighbourPairs(ids, selection).map(async (pair) =>
      pair === null ? null : await loadPair(release, slug, pair)
    )
  );

  return { ...compareColumns(versions, selection, loaded), release };
};

/**
 * Notes a comparison the page shows, so the browser knows the release to fetch from and what
 * stays on screen when a later one cannot be loaded. The server keeps nothing between requests.
 */
export const noteShown = <Shown extends PublishedComparison | null | undefined>(
  slug: string,
  comparison: Shown
) => {
  if (!isServer && comparison && comparison.failed !== true) {
    knownRelease = comparison.release;
    shown.set(slug, comparison);
  }

  return comparison;
};

/**
 * The comparison `request` asks for, built in the browser from the published files of the
 * release the page was rendered from (the same files and mapping as the server). Until a page
 * has shown a comparison there is no release to read from, so `readOnServer` answers, as it does
 * when the release has no comparison index (the collection has none, or the release is no longer
 * the active one). When a file cannot be loaded, the comparison already on screen is returned marked `failed`.
 */
export const compareInBrowser = async (
  slug: string,
  request: CompareRequest,
  readOnServer: () => Promise<PublishedComparison | null>
) => {
  const release = knownRelease;

  if (release === undefined) {
    return noteShown(slug, await readOnServer());
  }

  try {
    const built = await buildComparison(release, slug, request);

    return noteShown(slug, built ?? (await readOnServer()));
  } catch (error) {
    if (error instanceof MissingFileError) {
      knownRelease = undefined;
    }

    const before = shown.get(slug);

    return before === undefined
      ? noteShown(slug, await readOnServer())
      : { ...before, failed: true };
  }
};
