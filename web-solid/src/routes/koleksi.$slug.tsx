import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, getRouteApi, notFound } from "@tanstack/solid-router";
import { Show } from "solid-js";

import { CollectionReader } from "../components/collection-reader.tsx";
import { collectionQuery } from "../lib/queries";

const route = getRouteApi("/koleksi/$slug");

const CollectionPage = () => {
  const params = route.useParams();
  const collection = useQuery(() => collectionQuery(params().slug));

  return (
    <Show when={collection.data} keyed>
      {(record) => <CollectionReader collection={record} />}
    </Show>
  );
};

export const Route = createFileRoute("/koleksi/$slug")({
  loader: async ({ context, params }) => {
    const collection = await context.queryClient.query({
      ...collectionQuery(params.slug),
      staleTime: "static",
    });

    if (collection === null) {
      throw notFound();
    }

    return { name: collection.name };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Koleksi"} | Hukum Bersih` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CollectionPage,
});
