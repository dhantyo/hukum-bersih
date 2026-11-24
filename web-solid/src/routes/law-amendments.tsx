import type { RouteProps } from "@solidjs/router";
import { createMemo, Show } from "solid-js";

import { AmendmentComparison } from "../components/amendment-comparison.tsx";
import { useNoindex, usePageTitle } from "../lib/head.ts";
import { lawUrl } from "../lib/paths.ts";
import { comparisonQuery } from "../lib/queries.ts";
import NotFound from "./not-found.tsx";

const AmendmentsPage = (props: RouteProps<"/uu/:nomor/:tahun/perubahan">) => {
  const comparison = createMemo(
    async () => await comparisonQuery(lawUrl(props.params))
  );

  return (
    <Show when={comparison()} fallback={<NotFound />} keyed>
      {(record) => {
        usePageTitle(() => "Perubahan");
        useNoindex();

        return <AmendmentComparison comparison={record} />;
      }}
    </Show>
  );
};

export default AmendmentsPage;
