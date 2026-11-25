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

const loadPages = async (results: { data: () => Promise<SearchHit> }[]) => {
  const loaded: SearchHit[] = [];
  const last = Math.min(results.length, HIT_LIMIT);

  for (
    let from = 0;
    from < last && groupByPage(loaded).length < PAGE_LIMIT;
    from += BATCH_SIZE
  ) {
    const batch = results.slice(from, Math.min(from + BATCH_SIZE, last));

    // oxlint-disable-next-line no-await-in-loop -- a batch is fetched only while the pages so far are too few
    const hits = await Promise.all(
      batch.map(async (result) => await result.data())
    );

    loaded.push(...hits.filter((hit) => v.is(searchHitLink, hit.url)));
  }

  return groupByPage(loaded).slice(0, PAGE_LIMIT);
};

const findText = async (release: string, query: string) => {
  const modulePath = `/search-index/${release}/pagefind.js`;

  // oxlint-disable-next-line typescript/no-unsafe-assignment -- the Pagefind bundle is loaded at runtime from the active release and ships no types
  const pagefind: Pagefind = await import(
    /* @vite-ignore */
    modulePath
  );

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
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a block-level message, not an inline output */}
        <p role="status">Pencarian teks gagal. Coba lagi.</p>
      </Show>
      <Show
        when={
          state() === "ready" && pages().length === 0 && !props.hasCatalogHits
        }
      >
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a block-level message, not an inline output */}
        <p role="status">Tidak ada hasil.</p>
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
