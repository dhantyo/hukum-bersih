import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, notFound } from "@tanstack/solid-router";
import { Show } from "solid-js";

import { CollectionReader } from "../CollectionReader";
import { collectionQuery } from "../lib/queries";

export const Route = createFileRoute("/koleksi/$slug_/$versi")({
  loader: async ({ context, params }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.versi)) {
      throw notFound();
    }

    const collection = await context.queryClient.ensureQueryData(
      collectionQuery(params.slug, params.versi)
    );

    if (!collection) {
      throw notFound();
    }

    return { name: collection.name, date: params.versi };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.name ?? "Koleksi"} · ${loaderData?.date ?? ""} | Hukum Bersih`,
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DatedCollectionPage,
});

function DatedCollectionPage() {
  const params = Route.useParams();

  const collection = useQuery(() =>
    collectionQuery(params().slug, params().versi)
  );

  return (
    <Show when={collection.data} keyed>
      {(record) => <CollectionReader collection={record} />}
    </Show>
  );
}
