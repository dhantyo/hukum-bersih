import { createRouter, defineRoute, intentPreload } from "@solidjs/router";
import { lazy } from "solid-js";
import * as v from "valibot";

import { preloadCollection } from "./lib/collection-page.ts";
import { comparisonRequest } from "./lib/compare.ts";
import { lawUrl } from "./lib/paths.ts";
import {
  collectionsQuery,
  draftBillQuery,
  draftBillsQuery,
  draftComparisonQuery,
  draftTextQuery,
  overviewQuery,
  readerQuery,
  searchQuery,
  yearQuery,
} from "./lib/queries.ts";
import { compareSearch, searchPage, versionDate } from "./lib/schemas.ts";

export const Router = createRouter({
  routes: [
    {
      path: "/",
      component: lazy(async () => await import("./routes/home.tsx")),
      preload: () => {
        void overviewQuery();
        void draftBillsQuery();
      },
    },
    {
      path: "/uu",
      component: lazy(async () => await import("./routes/law-overview.tsx")),
      preload: () => {
        void overviewQuery();
      },
    },
    defineRoute({
      path: "/uu/tahun/:tahun",
      component: lazy(async () => await import("./routes/law-year.tsx")),
      preload: ({ params }) => {
        void yearQuery(params.tahun);
      },
    }),
    defineRoute({
      path: "/uu/:nomor/:tahun",
      search: compareSearch,
      component: lazy(async () => await import("./routes/law.tsx")),
      preload: ({ params, location }) => {
        const search = v.parse(compareSearch, location.query);

        void readerQuery(lawUrl(params), comparisonRequest(search));
      },
    }),
    {
      path: "/koleksi",
      component: lazy(
        async () => await import("./routes/collection-index.tsx")
      ),
      preload: () => {
        void collectionsQuery();
      },
    },
    defineRoute({
      path: "/koleksi/:slug/:versi",
      matchFilters: { versi: (versi: string) => v.is(versionDate, versi) },
      search: compareSearch,
      component: lazy(
        async () => await import("./routes/collection-version.tsx")
      ),
      preload: ({ params, location }) => {
        preloadCollection(
          params.slug,
          params.versi,
          v.parse(compareSearch, location.query)
        );
      },
    }),
    defineRoute({
      path: "/koleksi/:slug",
      search: compareSearch,
      component: lazy(async () => await import("./routes/collection.tsx")),
      preload: ({ params, location }) => {
        preloadCollection(
          params.slug,
          "latest",
          v.parse(compareSearch, location.query)
        );
      },
    }),
    {
      path: "/ruu",
      component: lazy(async () => await import("./routes/draft-index.tsx")),
      preload: () => {
        void draftBillsQuery();
      },
    },
    defineRoute({
      path: "/ruu/:slug/beda/:pair",
      component: lazy(
        async () => await import("./routes/draft-comparison.tsx")
      ),
      preload: ({ params }) => {
        void draftComparisonQuery(params.slug, params.pair);
      },
    }),
    defineRoute({
      path: "/ruu/:slug/:doc",
      component: lazy(async () => await import("./routes/draft-document.tsx")),
      preload: ({ params }) => {
        void draftTextQuery(params.slug, params.doc);
      },
    }),
    defineRoute({
      path: "/ruu/:slug",
      component: lazy(async () => await import("./routes/draft.tsx")),
      preload: ({ params }) => {
        void draftBillQuery(params.slug);
      },
    }),
    {
      path: "/cari",
      search: searchPage,
      component: lazy(async () => await import("./routes/search.tsx")),
      preload: ({ location }) => {
        void searchQuery(v.parse(searchPage, location.query).q);
      },
    },
    {
      path: "/tentang",
      component: lazy(async () => await import("./routes/about.tsx")),
    },
    {
      path: "*404",
      component: lazy(async () => await import("./routes/not-found.tsx")),
    },
  ],
  preloadLinks: intentPreload(),
});
