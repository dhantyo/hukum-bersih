import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, getRouteApi, notFound } from "@tanstack/solid-router";
import { Show } from "solid-js";
import * as v from "valibot";

import { LawReader } from "../components/law-reader.tsx";
import { readerQuery } from "../lib/queries";

import "../reader.css";

const route = getRouteApi("/uu/$nomor/$tahun");

const compareParams = v.object({
  bandingkan: v.fallback(v.optional(v.string()), undefined),
  dari: v.fallback(v.optional(v.string()), undefined),
});

const LawPage = () => {
  const params = route.useParams();
  const search = route.useSearch();

  const reader = useQuery(() =>
    readerQuery(
      `/uu/${params().nomor}/${params().tahun}/`,
      search().bandingkan,
      search().dari
    )
  );

  return (
    <Show when={reader.data} keyed>
      {(record) => <LawReader {...record} />}
    </Show>
  );
};

export const Route = createFileRoute("/uu/$nomor/$tahun")({
  validateSearch: compareParams,
  loaderDeps: ({ search }) => ({
    compareTo: search.bandingkan,
    compareFrom: search.dari,
  }),
  loader: async ({ context, params, deps }) => {
    const path = `/uu/${params.nomor}/${params.tahun}/`;

    const reader = await context.queryClient.query({
      ...readerQuery(path, deps.compareTo, deps.compareFrom),
      staleTime: "static",
    });

    if (reader === null) {
      throw notFound();
    }

    return { title: reader.law.shortName ?? reader.law.title };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.title ?? "Undang-undang"} | Hukum Bersih` }],
  }),
  component: LawPage,
});
