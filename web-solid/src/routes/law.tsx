import type { RouteProps } from "@solidjs/router";
import { createMemo, Show } from "solid-js";
import * as v from "valibot";

import { LawReader } from "../components/law-reader.tsx";
import { usePageTitle } from "../lib/head.ts";
import { lawUrl } from "../lib/paths.ts";
import { readerQuery } from "../lib/queries.ts";
import { compareSearch } from "../lib/schemas.ts";
import NotFound from "./not-found.tsx";

const LawPage = (props: RouteProps<"/uu/:nomor/:tahun">) => {
  const reader = createMemo(async () => {
    const search = v.parse(compareSearch, props.location.query);

    return await readerQuery(
      lawUrl(props.params),
      search.bandingkan,
      search.dari
    );
  });

  return (
    <Show when={reader()} fallback={<NotFound />} keyed>
      {(record) => {
        usePageTitle(() => record.law.shortName ?? record.law.title);

        return <LawReader {...record} />;
      }}
    </Show>
  );
};

export default LawPage;
