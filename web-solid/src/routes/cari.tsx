import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, getRouteApi } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import * as v from "valibot";

import { FullTextSearch } from "../components/full-text-search.tsx";
import { LawCatalog } from "../components/law-catalog.tsx";
import { searchQuery } from "../lib/queries";
import { searchText } from "../lib/schemas.ts";

const route = getRouteApi("/cari");

const searchSchema = v.object({ q: v.optional(searchText, "") });

const SearchPage = () => {
  const searchParams = route.useSearch();
  const search = useQuery(() => searchQuery(searchParams().q));

  return (
    <main>
      <h1>Cari teks hukum</h1>
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- keeps the form markup the Astro site serves */}
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
            <Show when={catalog.articles.length > 0}>
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
            <Show when={catalog.collections.length > 0}>
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
            <Show when={catalog.laws.length > 0}>
              <h2>Nomor dan judul</h2>
              <LawCatalog laws={catalog.laws} />
            </Show>
            <FullTextSearch
              release={search.data.release}
              query={search.data.query}
              hasCatalogHits={
                catalog.articles.length > 0 ||
                catalog.collections.length > 0 ||
                catalog.laws.length > 0
              }
            />
          </>
        )}
      </Show>
    </main>
  );
};

export const Route = createFileRoute("/cari")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ query: search.q }),
  loader: async ({ context, deps }) => {
    await context.queryClient.query({
      ...searchQuery(deps.query),
      staleTime: "static",
    });
  },
  head: () => ({ meta: [{ title: "Cari | Hukum Bersih" }] }),
  component: SearchPage,
});
