import { createFileRoute, notFound } from '@tanstack/solid-router';
import { LawReader } from '../LawReader';
import { getLaw } from '../lib/laws';
import '../reader.css';

export const Route = createFileRoute('/uu/$nomor/$tahun')({
  validateSearch: (search: Record<string, unknown>) => ({
    bandingkan: typeof search.bandingkan === 'string' ? search.bandingkan : undefined,
    dari: typeof search.dari === 'string' ? search.dari : undefined,
  }),
  loaderDeps: ({ search }) => ({ compareTo: search.bandingkan, compareFrom: search.dari }),
  loader: async ({ params, deps }) => {
    const reader = await getLaw(`/uu/${params.nomor}/${params.tahun}/`, deps.compareTo, deps.compareFrom);
    if (!reader) throw notFound();
    return reader;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.law.shortName ?? loaderData?.law.title ?? 'Undang-undang'} | Hukum Bersih` }],
  }),
  component: LawPage,
});

function LawPage() {
  const reader = Route.useLoaderData();
  return <LawReader {...reader()} />;
}
