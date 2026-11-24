import { createFileRoute, notFound } from '@tanstack/solid-router';
import { LawCatalog } from '../LawCatalog';
import { getLawYear } from '../lib/catalog';

export const Route = createFileRoute('/uu/tahun/$tahun')({
  loader: async ({ params }) => {
    const laws = await getLawYear(params.tahun);
    if (!laws.length) throw notFound();
    return laws;
  },
  head: ({ params }) => ({
    meta: [{ title: `Undang-Undang tahun ${params.tahun} | Hukum Bersih` }, { name: 'robots', content: 'noindex' }],
  }),
  component: LawYear,
});

function LawYear() {
  const params = Route.useParams();
  const laws = Route.useLoaderData();
  return <main>
    <a href="/uu/">Undang-Undang</a>
    <h1>Undang-Undang tahun {params().tahun}</h1>
    <p>{laws().length} undang-undang, terbaru di atas.</p>
    <LawCatalog laws={laws()} />
  </main>;
}
