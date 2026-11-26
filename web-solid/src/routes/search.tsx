import { useNavigate } from "@solidjs/router";
import type { RouteProps } from "@solidjs/router";
import { isServer } from "@solidjs/web";
import {
  createEffect,
  createMemo,
  createSignal,
  onSettled,
  Show,
} from "solid-js";
import * as v from "valibot";

import { FullTextSearch } from "../components/full-text-search.tsx";
import { PageTitle } from "../components/page-title.tsx";
import { SearchBox } from "../components/search-box.tsx";
import {
  ArticleResults,
  CollectionResults,
  LawResults,
  SearchExamples,
  searchStyles,
} from "../components/search-results.tsx";
import { useHydrated } from "../lib/after-hydration.ts";
import type { Catalog } from "../lib/catalog-record.ts";
import { searchPage, searchText } from "../lib/schemas.ts";
import { corpusRelease, loadCatalog } from "../lib/search-data.ts";
import { searchUrl } from "../lib/search-form.ts";
import { searchMatches } from "../lib/search-matches.ts";
import { css } from "../styles/css.ts";

const URL_PAUSE_MS = 200;

const SearchPage = (props: RouteProps<"/cari">) => {
  const navigate = useNavigate();
  const hydrated = useHydrated();
  const [typed, setTyped] = createSignal<string | undefined>(undefined);
  const [catalog, setCatalog] = createSignal<Catalog | undefined>(undefined);
  const [failed, setFailed] = createSignal(false);
  let pause: ReturnType<typeof setTimeout> | undefined;
  let written: string | undefined;

  const addressed = () =>
    !isServer && hydrated() ? v.parse(searchPage, props.location.query).q : "";

  const text = () => typed() ?? addressed();
  const query = () => v.parse(searchText, text());

  const found = createMemo(() => {
    const loaded = catalog();

    return loaded === undefined || query() === ""
      ? undefined
      : searchMatches(query(), loaded);
  });

  const catalogMissed = () => {
    const matches = found();

    return (
      matches !== undefined &&
      matches.articles.length === 0 &&
      matches.collections.length === 0 &&
      matches.laws.length === 0
    );
  };

  const writeAddress = (next: string) => {
    clearTimeout(pause);
    written = next;
    navigate(searchUrl(next), { replace: true, scroll: false });
  };

  const load = async () => {
    try {
      setCatalog(await loadCatalog());
    } catch (error) {
      console.error("Law catalog failed to load", error);
      setFailed(true);
    }
  };

  createEffect(addressed, (next) => {
    if (next !== written) {
      written = next;
      setTyped(undefined);
    }
  });

  onSettled(() => {
    void load();

    return () => {
      clearTimeout(pause);
    };
  });

  return (
    <main>
      <PageTitle>Cari</PageTitle>
      <h1>Cari</h1>
      <SearchBox
        query={text()}
        onQuery={(value) => {
          setTyped(value);
          clearTimeout(pause);

          pause = setTimeout(() => {
            writeAddress(v.parse(searchText, value));
          }, URL_PAUSE_MS);
        }}
        onSubmit={() => {
          writeAddress(query());
        }}
      />
      <Show when={query() !== ""} fallback={<SearchExamples />}>
        <div class={css(searchStyles.results)} aria-live="polite">
          <Show when={failed()}>
            <output>Katalog peraturan gagal dimuat. Muat ulang halaman.</output>
          </Show>
          <Show when={found()} keyed>
            {(matches) => (
              <>
                <Show when={matches.articles.length > 0}>
                  <ArticleResults articles={matches.articles} />
                </Show>
                <Show when={matches.collections.length > 0}>
                  <CollectionResults collections={matches.collections} />
                </Show>
                <Show when={matches.laws.length > 0}>
                  <LawResults laws={matches.laws} />
                </Show>
              </>
            )}
          </Show>
          <FullTextSearch
            release={corpusRelease()}
            query={query()}
            catalogMissed={catalogMissed()}
          />
        </div>
      </Show>
    </main>
  );
};

export default SearchPage;
