import { createMemo } from "solid-js";

import { LawCatalog } from "../components/law-catalog.tsx";
import { usePageTitle } from "../lib/head.ts";
import { draftBillsQuery } from "../lib/queries.ts";

const DraftIndex = () => {
  usePageTitle(() => "Rancangan Undang-Undang");
  const bills = createMemo(async () => await draftBillsQuery());

  return (
    <main>
      <h1>Rancangan Undang-Undang</h1>
      <LawCatalog laws={bills()} />
    </main>
  );
};

export default DraftIndex;
