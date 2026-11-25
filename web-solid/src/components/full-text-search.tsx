import * as stylex from "@stylexjs/stylex";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import * as v from "valibot";

import { searchHitLink } from "../lib/schemas.ts";
import {
  excerptParts,
  hitTitle,
  isRelated,
  searchWords,
  withoutHeading,
} from "../lib/search-excerpt.ts";
import { css } from "../styles/css.ts";
import { linkStyles } from "../styles/link.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import {
  SearchExamples,
  SearchGroup,
  SearchMore,
  searchStyles,
} from "./search-results.tsx";

interface SearchHit {
  url: string;
  excerpt: string;
  meta: { title?: string; label?: string };
}

interface SearchPage {
  url: string;
  title: string;
  hits: { url: string; label: string; excerpt: string }[];
}

interface PagefindResult {
  id: string;
  data: () => Promise<SearchHit>;
}

interface Pagefind {
  init: () => Promise<void>;
  search: (query: string) => Promise<{ results: PagefindResult[] }>;
}

interface Found {
  results: PagefindResult[];
  phrases: number;
  words: string[];
}

const PAGE_LIMIT = 10;
const BATCH_SIZE = 50;
const HIT_LIMIT = 500;
const HITS_PER_PAGE = 3;

const NO_SCRIPT_OFF = "@media (scripting: enabled)";

const styles = stylex.create({
  count: {
    margin: `0 0 ${space.s2}`,
    color: color.textMuted,
    fontSize: size.sm,
  },
  needsScript: {
    display: { [NO_SCRIPT_OFF]: "none", default: null },
  },
  subs: {
    margin: 0,
    listStyle: "none",
    paddingBlock: 0,
    borderInlineStartColor: color.line,
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: 2,
    marginBlockStart: space.s2,
    paddingInlineEnd: 0,
    paddingInlineStart: space.s4,
  },
  sub: { marginBlockEnd: space.s2 },
  subLink: { fontSize: size.sm, fontWeight: 600 },
  excerpt: {
    margin: `${space.s1} 0 0`,
    color: color.textMuted,
    fontSize: size.sm,
  },
  mark: {
    backgroundColor: color.linkBackground,
    color: color.text,
  },
  rest: { margin: 0, color: color.textMuted, fontSize: size.sm },
});

const groupByPage = (hits: SearchHit[]) => {
  const pages = new Map<string, SearchPage>();

  for (const hit of hits) {
    const [url] = hit.url.split("#");

    const page = pages.get(url) ?? {
      url,
      title: hitTitle(url, hit.meta.title ?? url),
      hits: [],
    };

    page.hits.push({
      url: hit.url,
      label: hit.meta.label ?? hit.url,
      excerpt: withoutHeading(hit.excerpt),
    });

    pages.set(url, page);
  }

  return [...pages.values()];
};

const isPagefind = (value: unknown): value is Pagefind =>
  typeof value === "object" &&
  value !== null &&
  "init" in value &&
  typeof value.init === "function" &&
  "search" in value &&
  typeof value.search === "function";

const loadPagefind = async (release: string) => {
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

const findResults = async (release: string, query: string) => {
  const pagefind = await loadPagefind(release);
  const words = searchWords(query);
  const isLoose = words.length > 1 && !query.includes('"');

  const [phrase, loose] = await Promise.all([
    pagefind.search(isLoose ? `"${query.trim()}"` : query),
    isLoose
      ? pagefind.search(words.join(" "))
      : Promise.resolve({ results: [] }),
  ]);

  const seen = new Set(phrase.results.map((result) => result.id));

  return {
    results: [
      ...phrase.results,
      ...loose.results.filter((result) => !seen.has(result.id)),
    ],
    phrases: phrase.results.length,
    words,
  };
};

const countText = (found: Found) => {
  const total = found.results.length;

  if (found.phrases === total || found.phrases === 0) {
    return `${total} bagian peraturan memuat ${found.words.length > 1 ? "kata-kata" : "kata"} ini.`;
  }

  return `${found.phrases} bagian memuat frasa ini persis; ${total - found.phrases} lainnya memuat semua katanya.`;
};

const loadHits: (
  found: Found,
  loaded: SearchHit[],
  from: number,
  pages: number
) => Promise<{ hits: SearchHit[]; next: number }> = async (
  found,
  loaded,
  from,
  pages
) => {
  const last = Math.min(found.results.length, HIT_LIMIT);

  if (from >= last || groupByPage(loaded).length >= pages) {
    return { hits: loaded, next: from };
  }

  const batch = found.results.slice(from, from + BATCH_SIZE);

  const read = await Promise.all(
    batch.map(async (result) => await result.data())
  );

  const wanted = read.filter(
    (hit) => v.is(searchHitLink, hit.url) && isRelated(hit.excerpt, found.words)
  );

  return await loadHits(
    found,
    [...loaded, ...wanted],
    from + BATCH_SIZE,
    pages
  );
};

const Excerpt = (props: { html: string }) => (
  <p class={css(styles.excerpt)}>
    <For each={excerptParts(props.html)}>
      {(part) => (
        <Show when={part.marked} fallback={part.text}>
          <mark class={css(styles.mark)}>{part.text}</mark>
        </Show>
      )}
    </For>
  </p>
);

const SearchResult = (props: { page: SearchPage }) => (
  <li class={css(searchStyles.item)}>
    <a class={css(searchStyles.name, linkStyles.base)} href={props.page.url}>
      {props.page.title}
    </a>
    <ul class={css(styles.subs)}>
      <For each={props.page.hits.slice(0, HITS_PER_PAGE)}>
        {(hit) => (
          <li class={css(styles.sub)}>
            <a class={css(styles.subLink, linkStyles.base)} href={hit.url}>
              {hit.label}
            </a>
            <Excerpt html={hit.excerpt} />
          </li>
        )}
      </For>
    </ul>
    <Show when={props.page.hits.length > HITS_PER_PAGE}>
      <p class={css(styles.rest)}>
        dan {props.page.hits.length - HITS_PER_PAGE} bagian lain di peraturan
        ini
      </p>
    </Show>
  </li>
);

export const FullTextSearch = (props: {
  release: string;
  query: string;
  hasCatalogHits: boolean;
}) => {
  const [hits, setHits] = createSignal<SearchHit[]>([]);
  const [found, setFound] = createSignal<Found | undefined>(undefined);
  const [cursor, setCursor] = createSignal(0);
  const [shown, setShown] = createSignal(PAGE_LIMIT);
  const [busy, setBusy] = createSignal(false);

  const [state, setState] = createSignal<"loading" | "ready" | "error">(
    "loading"
  );

  const pages = createMemo(() => groupByPage(hits()));

  const hasMore = () => {
    const current = found();

    return (
      pages().length > shown() ||
      (current !== undefined &&
        cursor() < Math.min(current.results.length, HIT_LIMIT))
    );
  };

  createEffect(
    () => ({ release: props.release, query: props.query }),
    ({ release, query }) => {
      let cancelled = false;
      setState("loading");

      const search = async () => {
        try {
          const result = await findResults(release, query);
          const loaded = await loadHits(result, [], 0, PAGE_LIMIT);

          if (cancelled) {
            return;
          }

          setFound(result);
          setHits(loaded.hits);
          setCursor(loaded.next);
          setShown(PAGE_LIMIT);
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

  const showMore = async () => {
    const current = found();

    if (current === undefined || busy()) {
      return;
    }

    const wanted = shown() + PAGE_LIMIT;
    setBusy(true);

    try {
      const loaded = await loadHits(current, hits(), cursor(), wanted);
      setHits(loaded.hits);
      setCursor(loaded.next);
      setShown(wanted);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p class={css(searchStyles.hint, styles.needsScript)}>
        Pencarian isi peraturan membutuhkan JavaScript.
      </p>
      <Show when={state() === "error"}>
        <output>Pencarian teks gagal. Coba lagi.</output>
      </Show>
      <Show
        when={
          state() === "ready" && pages().length === 0 && !props.hasCatalogHits
        }
      >
        <output class={css(searchStyles.results)}>
          <p>
            Tidak ada hasil untuk &quot;{props.query}&quot;. Periksa ejaannya,
            coba kata lain, atau cari dengan nomor (mis. 4/2009).
          </p>
          <SearchExamples />
        </output>
      </Show>
      <Show when={state() === "ready" && pages().length > 0}>
        <SearchGroup title="Isi peraturan">
          <Show when={found()} keyed>
            {(current) => (
              <output class={css(styles.count)}>{countText(current)}</output>
            )}
          </Show>
          <ul class={css(searchStyles.list)}>
            <For each={pages().slice(0, shown())}>
              {(page) => <SearchResult page={page} />}
            </For>
          </ul>
          <Show when={hasMore()}>
            <SearchMore
              onClick={() => {
                void showMore();
              }}
            />
          </Show>
        </SearchGroup>
      </Show>
    </>
  );
};
