import { createFileRoute, notFound } from '@tanstack/solid-router';
import { AmendmentComparison } from '../AmendmentComparison';
import { getLawComparison } from '../lib/laws';
import '../reader.css';

export const Route = createFileRoute('/uu/$nomor/$tahun_/perubahan')({
  loader: async ({ params }) => {
    const comparison = await getLawComparison(`/uu/${params.nomor}/${params.tahun}/`);
    if (!comparison) throw notFound();
    return comparison;
  },
  head: () => ({ meta: [{ title: 'Perubahan | Hukum Bersih' }, { name: 'robots', content: 'noindex' }] }),
  component: ComparisonPage,
});

function ComparisonPage() {
  const comparison = Route.useLoaderData();
  return <AmendmentComparison comparison={comparison()} />;
}
