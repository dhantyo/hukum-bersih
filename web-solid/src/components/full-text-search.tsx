import { createEffect, createSignal, For, Show } from "solid-js";
import * as v from "valibot";

import { searchHitLink } from "../lib/schemas.ts";
import { linkClass } from "../styles/link.ts";

interface SearchHit {
  url: string;
  meta: { title?: string };
  sub_results: { title: string; url: string }[];
}

interface Pagefind {
  init: () => Promise<void>;
  search: (
    query: string
  ) => Promise<{ results: { data: () => Promise<SearchHit> }[] }>;
}

const findText = async (release: string, query: string) => {
  const modulePath = `/search-index/${release}/pagefind.js`;

  // oxlint-disable-next-line typescript/no-unsafe-assignment -- the Pagefind bundle is loaded at runtime from the active release and ships no types
  const pagefind: Pagefind = await import(
    /* @vite-ignore */
    modulePath
  );

  await pagefind.init();
  const { results } = await pagefind.search(query);

  const matches = await Promise.all(
    results.slice(0, 10).map(async (result) => await result.data())
  );

  return matches.filter((match) => v.is(searchHitLink, match.url));
};

const SearchResult = (props: { hit: SearchHit }) => (
  <li>
    <a class={linkClass} href={props.hit.url}>
      {props.hit.meta.title ?? props.hit.url}
    </a>
    <ul>
      <For
        each={props.hit.sub_results.filter((article) =>
          v.is(searchHitLink, article.url)
        )}
      >
        {(article) => (
          <li>
            <a class={linkClass} href={article.url}>
              {article.title}
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
  const [hits, setHits] = createSignal<SearchHit[]>([]);

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

          setHits(matches);
          setState("ready");
        } catch (error) {
          if (cancelled) {
            return;
          }

          console.error("Pagefind search failed", error);
          setHits([]);
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
          state() === "ready" && hits().length === 0 && !props.hasCatalogHits
        }
      >
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a block-level message, not an inline output */}
        <p role="status">Tidak ada hasil.</p>
      </Show>
      <Show when={state() === "ready" && hits().length > 0}>
        <h2>Isi teks</h2>
        <ul>
          <For each={hits()}>{(hit) => <SearchResult hit={hit} />}</For>
        </ul>
      </Show>
    </>
  );
};
