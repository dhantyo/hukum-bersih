import { useQuery } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";

import { LawCatalog } from "../components/law-catalog.tsx";
import { draftBillsQuery } from "../lib/queries";

const DraftIndex = () => {
  const bills = useQuery(() => draftBillsQuery());

  return (
    <main>
      <h1>Rancangan Undang-Undang</h1>
      <LawCatalog laws={bills.data} />
    </main>
  );
};

export const Route = createFileRoute("/ruu/")({
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...draftBillsQuery(),
      staleTime: "static",
    });
  },
  head: () => ({ meta: [{ title: "Rancangan Undang-Undang | Hukum Bersih" }] }),
  component: DraftIndex,
});
