import { useQuery } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";

import { LawCatalog } from "../LawCatalog";
import { draftBillsQuery } from "../lib/queries";

export const Route = createFileRoute("/ruu/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(draftBillsQuery());
  },
  head: () => ({ meta: [{ title: "Rancangan Undang-Undang | Hukum Bersih" }] }),
  component: DraftIndex,
});

function DraftIndex() {
  const bills = useQuery(draftBillsQuery);

  return (
    <main>
      <h1>Rancangan Undang-Undang</h1>
      <LawCatalog laws={bills.data} />
    </main>
  );
}
