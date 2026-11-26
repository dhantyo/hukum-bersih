export interface SearchHit {
  url: string;
  excerpt: string;
  meta: { title?: string; label?: string };
}

export interface PagefindResult {
  id: string;
  data: () => Promise<SearchHit>;
}

export interface Pagefind {
  init: () => Promise<void>;
  search: (query: string) => Promise<{ results: PagefindResult[] }>;
}

const isPagefind = (value: unknown): value is Pagefind =>
  typeof value === "object" &&
  value !== null &&
  "init" in value &&
  typeof value.init === "function" &&
  "search" in value &&
  typeof value.search === "function";

const importPagefind = async (release: string) => {
  const modulePath = `/search-index/${release}/pagefind.js`;

  const pagefind: unknown = await import(
    /* @vite-ignore */
    modulePath
  );

  if (!isPagefind(pagefind)) {
    throw new Error(`${modulePath} is not a Pagefind bundle`);
  }

  await pagefind.init();

  return pagefind;
};

const loaded = new Map<string, Promise<Pagefind>>();

export const loadPagefind = async (release: string) => {
  const known = loaded.get(release);

  if (known !== undefined) {
    return await known;
  }

  const started = importPagefind(release);
  loaded.set(release, started);

  void started.catch(() => {
    loaded.delete(release);
  });

  return await started;
};
