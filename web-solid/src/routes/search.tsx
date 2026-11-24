import type { RouteProps } from "@solidjs/router";
import { createMemo, For, Show } from "solid-js";
import * as v from "valibot";

import { FullTextSearch } from "../components/full-text-search.tsx";
import { LawCatalog } from "../components/law-catalog.tsx";
import { usePageTitle } from "../lib/head.ts";
import { slashed } from "../lib/paths.ts";
import { searchQuery } from "../lib/queries.ts";
import { searchPage } from "../lib/schemas.ts";
import { Router } from "../router.tsx";

const SearchPage = (props: RouteProps<"/cari">) => {
  usePageTitle(() => "Cari");

  const search = createMemo(
    async () => await searchQuery(v.parse(searchPage, props.location.query).q)
  );

  return (
    <main>
      <h1>Cari teks hukum</h1>
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- keeps the form markup the Astro site serves */}
      <form role="search" method="get" action={slashed(Router.paths.cari)}>
        <label for="search-query">Kata kunci</label>
        <input
          id="search-query"
          name="q"
          type="search"
          value={search().query}
          maxlength={200}
          required
        />
        <button type="submit">Cari</button>
      </form>
      <Show when={search().catalog} keyed>
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
              release={search().release}
              query={search().query}
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

export default SearchPage;
