import { useNavigate } from "@solidjs/router";
import type { RouteProps } from "@solidjs/router";
import { createMemo, onSettled, Show } from "solid-js";
import * as v from "valibot";

import { PageTitle } from "../components/page-title.tsx";
import { SearchBox } from "../components/search-box.tsx";
import {
  ArticleResults,
  CollectionResults,
  LawResults,
  SearchExamples,
  searchStyles,
} from "../components/search-results.tsx";
import { searchQuery } from "../lib/queries.ts";
import { searchPage } from "../lib/schemas.ts";
import { searchUrl } from "../lib/search-form.ts";
import { css } from "../styles/css.ts";

const SearchPlainPage = (props: RouteProps<"/cari/hasil">) => {
  const navigate = useNavigate();

  const search = createMemo(
    async () => await searchQuery(v.parse(searchPage, props.location.query).q)
  );

  onSettled(() => {
    navigate(searchUrl(search().query), { replace: true });
  });

  return (
    <main>
      <PageTitle>Cari</PageTitle>
      <h1>Cari</h1>
      <SearchBox query={search().query} />
      <Show when={search().catalog} fallback={<SearchExamples />} keyed>
        {(catalog) => (
          <div class={css(searchStyles.results)}>
            <Show when={catalog.articles.length > 0}>
              <ArticleResults articles={catalog.articles} />
            </Show>
            <Show when={catalog.collections.length > 0}>
              <CollectionResults collections={catalog.collections} />
            </Show>
            <Show when={catalog.laws.length > 0}>
              <LawResults laws={catalog.laws} />
            </Show>
            <Show
              when={
                catalog.articles.length === 0 &&
                catalog.collections.length === 0 &&
                catalog.laws.length === 0
              }
            >
              <p>
                Tidak ada hasil untuk &quot;{search().query}&quot;. Periksa
                ejaannya, coba kata lain, atau cari dengan nomor (mis. 4/2009).
              </p>
            </Show>
            <p class={css(searchStyles.hint)}>
              Pencarian isi peraturan membutuhkan JavaScript.
            </p>
          </div>
        )}
      </Show>
    </main>
  );
};

export default SearchPlainPage;
