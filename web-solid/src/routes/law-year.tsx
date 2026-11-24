import type { RouteProps } from "@solidjs/router";
import { createMemo, Show } from "solid-js";

import { LawCatalog } from "../components/law-catalog.tsx";
import { useNoindex, usePageTitle } from "../lib/head.ts";
import { slashed } from "../lib/paths.ts";
import { yearQuery } from "../lib/queries.ts";
import { Router } from "../router.tsx";
import NotFound from "./not-found.tsx";

const LawYear = (props: RouteProps<"/uu/tahun/:tahun">) => {
  const laws = createMemo(async () => {
    const items = await yearQuery(props.params.tahun);

    return items.length > 0 ? items : undefined;
  });

  return (
    <Show when={laws()} fallback={<NotFound />} keyed>
      {(items) => {
        usePageTitle(() => `Undang-Undang tahun ${props.params.tahun}`);
        useNoindex();

        return (
          <main>
            <a href={slashed(Router.paths.uu)}>Undang-Undang</a>
            <h1>Undang-Undang tahun {props.params.tahun}</h1>
            <p>{items.length} undang-undang, terbaru di atas.</p>
            <LawCatalog laws={items} />
          </main>
        );
      }}
    </Show>
  );
};

export default LawYear;
