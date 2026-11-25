import { createEffect, createSignal, For, Show } from "solid-js";
import * as v from "valibot";

import { searchHitLink } from "../lib/schemas.ts";
import { linkClass } from "../styles/link.ts";

interface SearchHit {
  url: string;
  meta: { title?: string; label?: string };
}

interface SearchPage {
  url: string;
  title: string;
  hits: { url: string; label: string }[];
}

interface Pagefind {
  init: () => Promise<void>;
  search: (
    query: string
  ) => Promise<{ results: { data: () => Promise<SearchHit> }[] }>;
}

const PAGE_LIMIT = 10;
const BATCH_SIZE = 50;
const HIT_LIMIT = 500;

const groupByPage = (hits: SearchHit[]) => {
  const pages = new Map<string, SearchPage>();

  for (const hit of hits) {
    const [url] = hit.url.split("#");

    const page = pages.get(url) ?? {
      url,
      title: hit.meta.title ?? url,
      hits: [],
    };

    page.hits.push({ url: hit.url, label: hit.meta.label ?? hit.url });
    pages.set(url, page);
  }

  return [...pages.values()];
};

type PagefindResults = Awaited<ReturnType<Pagefind["search"]>>["results"];

const isPagefind = (value: unknown): value is Pagefind =>
  typeof value === "object" &&
  value !== null &&
  "init" in value &&
  typeof value.init === "function" &&
  "search" in value &&
  typeof value.search === "function";

const loadBatches: (
  results: PagefindResults,
  from: number,
  last: number,
  loaded: SearchHit[]
) => Promise<SearchHit[]> = async (results, from, last, loaded) => {
  if (from >= last || groupByPage(loaded).length >= PAGE_LIMIT) {
    return loaded;
  }

  const batch = results.slice(from, Math.min(from + BATCH_SIZE, last));

  const hits = await Promise.all(
    batch.map(async (result) => await result.data())
  );

  return await loadBatches(results, from + BATCH_SIZE, last, [
    ...loaded,
    ...hits.filter((hit) => v.is(searchHitLink, hit.url)),
  ]);
};

const loadPages = async (results: PagefindResults) => {
  const loaded = await loadBatches(
    results,
    0,
    Math.min(results.length, HIT_LIMIT),
    []
  );

  return groupByPage(loaded).slice(0, PAGE_LIMIT);
};

const findText = async (release: string, query: string) => {
  const modulePath = `/search-index/${release}/pagefind.js`;

  const pagefind: unknown = await import(
    /* @vite-ignore */
    modulePath
  );

  if (!isPagefind(pagefind)) {
    throw new Error(`${modulePath} is not a Pagefind bundle`);
  }

  await pagefind.init();
  const { results } = await pagefind.search(query);

  return await loadPages(results);
};

const SearchResult = (props: { page: SearchPage }) => (
  <li>
    <a class={linkClass} href={props.page.url}>
      {props.page.title}
    </a>
    <ul>
      <For each={props.page.hits}>
        {(hit) => (
          <li>
            <a class={linkClass} href={hit.url}>
              {hit.label}
            </a>
          </li>
        )}
      </For>
    </ul>
  </li>
);

export const FullTextSearch = (props: {
  release: string;
  query: string;
  hasCatalogHits: boolean;
}) => {
  const [pages, setPages] = createSignal<SearchPage[]>([]);

  const [state, setState] = createSignal<"loading" | "ready" | "error">(
    "loading"
  );

  createEffect(
    () => ({ release: props.release, query: props.query }),
    ({ release, query }) => {
      let cancelled = false;
      setState("loading");

      const search = async () => {
        try {
          const matches = await findText(release, query);

          if (cancelled) {
            return;
          }

          setPages(matches);
          setState("ready");
        } catch (error) {
          if (cancelled) {
            return;
          }

          console.error("Pagefind search failed", error);
          setPages([]);
          setState("error");
        }
      };

      void search();

      return () => {
        cancelled = true;
      };
    }
  );

  return (
    <>
      <Show when={state() === "error"}>
        <output>Pencarian teks gagal. Coba lagi.</output>
      </Show>
      <Show
        when={
          state() === "ready" && pages().length === 0 && !props.hasCatalogHits
        }
      >
        <output>Tidak ada hasil.</output>
      </Show>
      <Show when={state() === "ready" && pages().length > 0}>
        <h2>Isi teks</h2>
        <ul>
          <For each={pages()}>{(page) => <SearchResult page={page} />}</For>
        </ul>
      </Show>
    </>
  );
};
