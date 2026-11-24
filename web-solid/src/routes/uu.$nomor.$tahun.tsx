import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, notFound } from "@tanstack/solid-router";
import { Show } from "solid-js";

import { LawReader } from "../LawReader";
import { readerQuery } from "../lib/queries";

import "../reader.css";

export const Route = createFileRoute("/uu/$nomor/$tahun")({
  validateSearch: (search: Record<string, unknown>) => ({
    bandingkan:
      typeof search.bandingkan === "string" ? search.bandingkan : undefined,
    dari: typeof search.dari === "string" ? search.dari : undefined,
  }),
  loaderDeps: ({ search }) => ({
    compareTo: search.bandingkan,
    compareFrom: search.dari,
  }),
  loader: async ({ context, params, deps }) => {
    const path = `/uu/${params.nomor}/${params.tahun}/`;
    const reader = await context.queryClient.ensureQueryData(
      readerQuery(path, deps.compareTo, deps.compareFrom)
    );

    if (!reader) {
      throw notFound();
    }

    return { title: reader.law.shortName ?? reader.law.title };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.title ?? "Undang-undang"} | Hukum Bersih` }],
  }),
  component: LawPage,
});

function LawPage() {
  const params = Route.useParams();
  const search = Route.useSearch();

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
}
