import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, getRouteApi, notFound } from "@tanstack/solid-router";
import { Show } from "solid-js";
import * as v from "valibot";

import { CollectionReader } from "../components/collection-reader.tsx";
import { collectionQuery } from "../lib/queries";
import { versionDate } from "../lib/schemas.ts";

const route = getRouteApi("/koleksi/$slug_/$versi");

const DatedCollectionPage = () => {
  const params = route.useParams();

  const collection = useQuery(() =>
    collectionQuery(params().slug, params().versi)
  );

  return (
    <Show when={collection.data} keyed>
      {(record) => <CollectionReader collection={record} />}
    </Show>
  );
};

export const Route = createFileRoute("/koleksi/$slug_/$versi")({
  loader: async ({ context, params }) => {
    if (!v.is(versionDate, params.versi)) {
      throw notFound();
    }

    const collection = await context.queryClient.query({
      ...collectionQuery(params.slug, params.versi),
      staleTime: "static",
    });

    if (collection === null) {
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
