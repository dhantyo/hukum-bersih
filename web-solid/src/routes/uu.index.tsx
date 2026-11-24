import { useQuery } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { For } from "solid-js";

import { LawCatalog } from "../components/law-catalog.tsx";
import { overviewQuery } from "../lib/queries";

const LawOverview = () => {
  const overview = useQuery(() => overviewQuery());

  return (
    <main>
      <h1>Undang-Undang</h1>
      <p>{overview.data.total.toLocaleString("id-ID")} undang-undang.</p>
      <h2>Menurut tahun</h2>
      <ul>
        <For each={overview.data.years}>
          {({ year, count }) => (
            <li>
              <a href={`/uu/tahun/${year}/`}>{year}</a> · {count}
            </li>
          )}
        </For>
      </ul>
      <h2>Terbaru</h2>
      <LawCatalog laws={overview.data.recent} />
    </main>
  );
};

export const Route = createFileRoute("/uu/")({
  loader: async ({ context }) => {
    await context.queryClient.query({
      ...overviewQuery(),
      staleTime: "static",
    });
  },
  head: () => ({
    meta: [
      { title: "Undang-Undang | Hukum Bersih" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LawOverview,
});
