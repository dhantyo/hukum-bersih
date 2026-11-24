import { createMemo, For } from "solid-js";

import { LawCatalog } from "../components/law-catalog.tsx";
import { useNoindex, usePageTitle } from "../lib/head.ts";
import { slashed } from "../lib/paths.ts";
import { overviewQuery } from "../lib/queries.ts";
import { Router } from "../router.tsx";

const LawOverview = () => {
  usePageTitle(() => "Undang-Undang");
  useNoindex();
  const overview = createMemo(async () => await overviewQuery());

  return (
    <main>
      <h1>Undang-Undang</h1>
      <p>{overview().total.toLocaleString("id-ID")} undang-undang.</p>
      <h2>Menurut tahun</h2>
      <ul>
        <For each={overview().years}>
          {({ year, count }) => (
            <li>
              <a href={slashed(Router.paths.uu.tahun(year))}>{year}</a> ·{" "}
              {count}
            </li>
          )}
        </For>
      </ul>
      <h2>Terbaru</h2>
      <LawCatalog laws={overview().recent} />
    </main>
  );
};

export default LawOverview;
