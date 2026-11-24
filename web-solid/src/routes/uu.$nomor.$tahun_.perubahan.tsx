import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, getRouteApi, notFound } from "@tanstack/solid-router";
import { Show } from "solid-js";

import { AmendmentComparison } from "../components/amendment-comparison.tsx";
import { comparisonQuery } from "../lib/queries";

import "../reader.css";

const route = getRouteApi("/uu/$nomor/$tahun_/perubahan");

const ComparisonPage = () => {
  const params = route.useParams();

  const comparison = useQuery(() =>
    comparisonQuery(`/uu/${params().nomor}/${params().tahun}/`)
  );

  return (
    <Show when={comparison.data} keyed>
      {(record) => <AmendmentComparison comparison={record} />}
    </Show>
  );
};

export const Route = createFileRoute("/uu/$nomor/$tahun_/perubahan")({
  loader: async ({ context, params }) => {
    const comparison = await context.queryClient.query({
      ...comparisonQuery(`/uu/${params.nomor}/${params.tahun}/`),
      staleTime: "static",
    });

    if (comparison === null) {
      throw notFound();
    }
  },
  head: () => ({
    meta: [
      { title: "Perubahan | Hukum Bersih" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ComparisonPage,
});
