import type { RouteProps } from "@solidjs/router";
import { createMemo, Show } from "solid-js";

import { CollectionReader } from "../components/collection-reader.tsx";
import { useNoindex, usePageTitle } from "../lib/head.ts";
import { collectionQuery } from "../lib/queries.ts";
import NotFound from "./not-found.tsx";

const CollectionPage = (props: RouteProps<"/koleksi/:slug">) => {
  const collection = createMemo(
    async () => await collectionQuery(props.params.slug, "latest")
  );

  return (
    <Show when={collection()} fallback={<NotFound />} keyed>
      {(record) => {
        usePageTitle(() => record.name);
        useNoindex();

        return <CollectionReader collection={record} />;
      }}
    </Show>
  );
};

export default CollectionPage;
