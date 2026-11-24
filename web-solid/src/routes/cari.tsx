import { useQuery } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { createEffect, createSignal, For, Show } from "solid-js";

import { LawCatalog } from "../LawCatalog";
import { searchQuery } from "../lib/queries";

interface SearchHit {
  url: string;
  meta: { title?: string };
  sub_results: { title: string; url: string }[];
}

interface Pagefind {
  init(): Promise<void>;
  search(query: string): Promise<{ results: { data(): Promise<SearchHit> }[] }>;
}

function legalLink(url: string): boolean {
  return /^\/(?:uu|koleksi|ruu)\/[a-z0-9./_-]+(?:#[a-z0-9_.:%-]+)?$/i.test(url);
}

export const Route = createFileRoute("/cari")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q.trim().slice(0, 200) : "",
  }),
  loaderDeps: ({ search }) => ({ query: search.q ?? "" }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(searchQuery(deps.query));
  },
  head: () => ({ meta: [{ title: "Cari | Hukum Bersih" }] }),
  component: SearchPage,
});

function SearchPage() {
  const searchParams = Route.useSearch();
  const search = useQuery(() => searchQuery(searchParams().q ?? ""));

  return (
    <main>
      <h1>Cari teks hukum</h1>
      <form role="search" method="get" action="/cari/">
        <label for="search-query">Kata kunci</label>
        <input
          id="search-query"
          name="q"
          type="search"
          value={search.data.query}
          maxlength={200}
          required
        />
        <button type="submit">Cari</button>
      </form>
      <Show when={search.data.catalog} keyed>
        {(catalog) => (
          <>
            <Show when={catalog.articles.length}>
              <h2>Pasal</h2>
              <ul>
                <For each={catalog.articles}>
                  {(article) => (
                    <li>
                      <a href={article.url}>{article.label}</a>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
            <Show when={catalog.collections.length}>
              <h2>Koleksi</h2>
              <ul>
                <For each={catalog.collections}>
                  {(collection) => (
                    <li>
                      <a href={collection.u}>{collection.name}</a>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
            <Show when={catalog.laws.length}>
              <h2>Nomor dan judul</h2>
              <LawCatalog laws={catalog.laws} />
            </Show>
            <FullTextSearch
              release={search.data.release}
              query={search.data.query}
              hasCatalogHits={Boolean(
                catalog.articles.length ||
                catalog.collections.length ||
                catalog.laws.length
              )}
            />
          </>
        )}
      </Show>
    </main>
  );
}

function FullTextSearch(props: {
  release: string;
  query: string;
  hasCatalogHits: boolean;
}) {
  const [hits, setHits] = createSignal<SearchHit[]>([]);

  const [state, setState] = createSignal<"loading" | "ready" | "error">(
    "loading"
  );

  createEffect(
    () => ({ release: props.release, query: props.query }),
    ({ release, query }) => {
      let cancelled = false;
      setState("loading");
      void findText(release, query).then(
        (matches) => {
          if (cancelled) {
            return;
          }

          setHits(matches);
          setState("ready");
        },
        (error: unknown) => {
          if (cancelled) {
            return;
          }

          console.error("Pagefind search failed", error);
          setHits([]);
          setState("error");
        }
      );

      return () => {
        cancelled = true;
      };
    }
  );

  return (
    <>
      <Show when={state() === "error"}>
        <p role="status">Pencarian teks gagal. Coba lagi.</p>
      </Show>
      <Show
        when={state() === "ready" && !hits().length && !props.hasCatalogHits}
      >
        <p role="status">Tidak ada hasil.</p>
      </Show>
      <Show when={state() === "ready" && hits().length}>
        <h2>Isi teks</h2>
        <ul>
          <For each={hits()}>{(hit) => <SearchResult hit={hit} />}</For>
        </ul>
      </Show>
    </>
  );
}

async function findText(release: string, query: string) {
  const modulePath = `/search-index/${release}/pagefind.js`;
  const pagefind: Pagefind = await import(/* @vite-ignore */ modulePath);
  await pagefind.init();
  const { results } = await pagefind.search(query);

  const matches = await Promise.all(
    results.slice(0, 10).map(async (result) => await result.data())
  );

  return matches.filter((match) => legalLink(match.url));
}

function SearchResult(props: { hit: SearchHit }) {
  return (
    <li>
      <a href={props.hit.url}>{props.hit.meta.title ?? props.hit.url}</a>
      <ul>
        <For
          each={props.hit.sub_results.filter((article) =>
            legalLink(article.url)
          )}
        >
          {(article) => (
            <li>
              <a href={article.url}>{article.title}</a>
            </li>
          )}
        </For>
      </ul>
    </li>
  );
}
