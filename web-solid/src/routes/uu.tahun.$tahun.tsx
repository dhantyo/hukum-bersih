import { useQuery } from '@tanstack/solid-query';
import { createFileRoute, notFound } from '@tanstack/solid-router';
import { LawCatalog } from '../LawCatalog';
import { yearQuery } from '../lib/queries';

export const Route = createFileRoute('/uu/tahun/$tahun')({
  loader: async ({ context, params }) => {
    const laws = await context.queryClient.ensureQueryData(yearQuery(params.tahun));
    if (!laws.length) throw notFound();
  },
  head: ({ params }) => ({
    meta: [{ title: `Undang-Undang tahun ${params.tahun} | Hukum Bersih` }, { name: 'robots', content: 'noindex' }],
  }),
  component: LawYear,
});

function LawYear() {
  const params = Route.useParams();
  const laws = useQuery(() => yearQuery(params().tahun));
  return <main>
    <a href="/uu/">Undang-Undang</a>
    <h1>Undang-Undang tahun {params().tahun}</h1>
    <p>{laws.data.length} undang-undang, terbaru di atas.</p>
    <LawCatalog laws={laws.data} />
  </main>;
}
