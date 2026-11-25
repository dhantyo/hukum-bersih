import type { RouteProps } from "@solidjs/router";
import { Show } from "solid-js";
import * as v from "valibot";

import { CollectionReader } from "../components/collection-reader.tsx";
import { useCollection } from "../lib/collection-page.ts";
import { usePageTitle } from "../lib/head.ts";
import { compareSearch } from "../lib/schemas.ts";
import NotFound from "./not-found.tsx";

const CollectionPage = (props: RouteProps<"/koleksi/:slug">) => {
  const page = useCollection(
    () => props.params.slug,
    () => "latest",
    () => v.parse(compareSearch, props.location.query)
  );

  return (
    <Show when={page.collection()} fallback={<NotFound />} keyed>
      {(record) => {
        usePageTitle(() => record.merged?.title ?? record.name);

        return (
          <CollectionReader
            collection={record}
            comparison={page.comparison() ?? null}
            dated={false}
          />
        );
      }}
    </Show>
  );
};

export default CollectionPage;
