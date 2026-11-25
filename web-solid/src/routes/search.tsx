import type { RouteProps } from "@solidjs/router";
import { createMemo, Show } from "solid-js";
import * as v from "valibot";

import { FullTextSearch } from "../components/full-text-search.tsx";
import { SearchBox } from "../components/search-box.tsx";
import {
  ArticleResults,
  CollectionResults,
  LawResults,
  SearchExamples,
  searchStyles,
} from "../components/search-results.tsx";
import { usePageTitle } from "../lib/head.ts";
import { searchQuery } from "../lib/queries.ts";
import { searchPage } from "../lib/schemas.ts";
import { css } from "../styles/css.ts";

const SearchPage = (props: RouteProps<"/cari">) => {
  usePageTitle(() => "Cari");

  const search = createMemo(
    async () => await searchQuery(v.parse(searchPage, props.location.query).q)
  );

  return (
    <main>
      <h1>Cari</h1>
      <SearchBox query={search().query} />
      <Show when={search().catalog} fallback={<SearchExamples />} keyed>
        {(catalog) => (
          <div class={css(searchStyles.results)} aria-live="polite">
            <Show when={catalog.articles.length > 0}>
              <ArticleResults articles={catalog.articles} />
            </Show>
            <Show when={catalog.collections.length > 0}>
              <CollectionResults collections={catalog.collections} />
            </Show>
            <Show when={catalog.laws.length > 0}>
              <LawResults laws={catalog.laws} />
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
          </div>
        )}
      </Show>
    </main>
  );
};

export default SearchPage;
