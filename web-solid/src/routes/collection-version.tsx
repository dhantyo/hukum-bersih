import type { RouteProps } from "@solidjs/router";
import { createMemo, Show } from "solid-js";

import { CollectionReader } from "../components/collection-reader.tsx";
import { useNoindex, usePageTitle } from "../lib/head.ts";
import { collectionQuery } from "../lib/queries.ts";
import NotFound from "./not-found.tsx";

const DatedCollectionPage = (props: RouteProps<"/koleksi/:slug/:versi">) => {
  const collection = createMemo(
    async () => await collectionQuery(props.params.slug, props.params.versi)
  );

  return (
    <Show when={collection()} fallback={<NotFound />} keyed>
      {(record) => {
        usePageTitle(() => `${record.name} · ${props.params.versi}`);
        useNoindex();

        return <CollectionReader collection={record} />;
      }}
    </Show>
  );
};

export default DatedCollectionPage;
