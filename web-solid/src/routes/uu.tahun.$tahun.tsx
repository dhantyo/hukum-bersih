import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, getRouteApi, notFound } from "@tanstack/solid-router";

import { LawCatalog } from "../components/law-catalog.tsx";
import { yearQuery } from "../lib/queries";

const route = getRouteApi("/uu/tahun/$tahun");

const LawYear = () => {
  const params = route.useParams();
  const laws = useQuery(() => yearQuery(params().tahun));

  return (
    <main>
      <a href="/uu/">Undang-Undang</a>
      <h1>Undang-Undang tahun {params().tahun}</h1>
      <p>{laws.data.length} undang-undang, terbaru di atas.</p>
      <LawCatalog laws={laws.data} />
    </main>
  );
};

export const Route = createFileRoute("/uu/tahun/$tahun")({
  loader: async ({ context, params }) => {
    const laws = await context.queryClient.query({
      ...yearQuery(params.tahun),
      staleTime: "static",
    });

    if (laws.length === 0) {
      throw notFound();
    }
  },
  head: ({ params }) => ({
    meta: [
      { title: `Undang-Undang tahun ${params.tahun} | Hukum Bersih` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LawYear,
});
