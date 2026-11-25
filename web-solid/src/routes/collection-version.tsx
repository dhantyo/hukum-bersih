import type { RouteProps } from "@solidjs/router";
import { Show } from "solid-js";
import * as v from "valibot";

import { tanggal } from "../../../web/src/lib/labels.ts";
import { CollectionReader } from "../components/collection-reader.tsx";
import { useCollection } from "../lib/collection-page.ts";
import { usePageTitle } from "../lib/head.ts";
import { compareSearch } from "../lib/schemas.ts";
import NotFound from "./not-found.tsx";

const DatedCollectionPage = (props: RouteProps<"/koleksi/:slug/:versi">) => {
  const page = useCollection(
    () => props.params.slug,
    () => props.params.versi,
    () => v.parse(compareSearch, props.location.query)
  );

  return (
    <Show when={page.collection()} fallback={<NotFound />} keyed>
      {(record) => {
        usePageTitle(
          () =>
            `${record.merged?.title ?? record.name} (versi ${tanggal(props.params.versi)})`
        );

        return (
          <CollectionReader
            collection={record}
            comparison={page.comparison() ?? null}
            dated
          />
        );
      }}
    </Show>
  );
};

export default DatedCollectionPage;
