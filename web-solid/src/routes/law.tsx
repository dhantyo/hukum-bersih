import type { RouteProps } from "@solidjs/router";
import { createMemo, Show } from "solid-js";
import * as v from "valibot";

import { LawReader } from "../components/law-reader.tsx";
import { PageTitle } from "../components/page-title.tsx";
import { useLawComparison } from "../lib/law-page.ts";
import { lawUrl } from "../lib/paths.ts";
import { lawQuery } from "../lib/queries.ts";
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
  const record = createMemo(async () => await lawQuery(lawUrl(props.params)));

  return (
    <Show when={record()} fallback={<NotFound />} keyed>
      {(law) => {
        const comparison = useLawComparison(law, () =>
          v.parse(compareSearch, props.location.query)
        );

        return (
          <>
            <PageTitle>{pageTitle(law)}</PageTitle>
            <LawReader law={law} comparison={comparison()} />
          </>
        );
      }}
    </Show>
  );
};

export default LawPage;
