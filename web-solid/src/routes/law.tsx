import type { RouteProps } from "@solidjs/router";
import { createMemo, Show } from "solid-js";
import * as v from "valibot";

import { LawReader } from "../components/law-reader.tsx";
import { usePageTitle } from "../lib/head.ts";
import { lawUrl } from "../lib/paths.ts";
import { readerQuery } from "../lib/queries.ts";
import { compareSearch } from "../lib/schemas.ts";
import { isPresent } from "../lib/text.ts";
import type { LawRecord } from "../server/records/law.ts";
import NotFound from "./not-found.tsx";

const pageTitle = (law: LawRecord) => {
  const name =
    law.shortName === undefined ? law.cite : `${law.shortName} (${law.cite})`;

  return isPresent(law.subject) ? `${name} tentang ${law.subject}` : name;
};

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
        usePageTitle(() => pageTitle(record.law));

        return <LawReader law={record.law} comparison={record.comparison} />;
      }}
    </Show>
  );
};

export default LawPage;
