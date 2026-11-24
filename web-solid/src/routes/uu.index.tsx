import { createFileRoute } from '@tanstack/solid-router';
import { For } from 'solid-js';
import { LawCatalog } from '../LawCatalog';
import { getLawOverview } from '../lib/catalog';

export const Route = createFileRoute('/uu/')({
  loader: () => getLawOverview(),
  head: () => ({ meta: [{ title: 'Undang-Undang | Hukum Bersih' }, { name: 'robots', content: 'noindex' }] }),
  component: LawOverview,
});

function LawOverview() {
  const overview = Route.useLoaderData();
  return <main>
    <h1>Undang-Undang</h1>
    <p>{overview().total.toLocaleString('id-ID')} undang-undang.</p>
    <h2>Menurut tahun</h2>
    <ul><For each={overview().years}>{({ year, count }) =>
      <li><a href={`/uu/tahun/${year}/`}>{year}</a> · {count}</li>
    }</For></ul>
    <h2>Terbaru</h2>
    <LawCatalog laws={overview().recent} />
  </main>;
}
