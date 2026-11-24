import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, notFound } from "@tanstack/solid-router";
import { Show } from "solid-js";

import { AmendmentComparison } from "../components/amendment-comparison.tsx";
import { comparisonQuery } from "../lib/queries";

import "../reader.css";

export const Route = createFileRoute("/uu/$nomor/$tahun_/perubahan")({
  loader: async ({ context, params }) => {
    const comparison = await context.queryClient.ensureQueryData(
      comparisonQuery(`/uu/${params.nomor}/${params.tahun}/`)
    );

    if (!comparison) {
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

function ComparisonPage() {
  const params = Route.useParams();

  const comparison = useQuery(() =>
    comparisonQuery(`/uu/${params().nomor}/${params().tahun}/`)
  );

  return (
    <Show when={comparison.data} keyed>
      {(record) => <AmendmentComparison comparison={record} />}
    </Show>
  );
}
