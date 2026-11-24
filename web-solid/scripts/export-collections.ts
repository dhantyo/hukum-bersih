import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readerText } from './reader-text.ts';

const [stage] = process.argv.slice(2);
if (!stage) throw new Error('Use pnpm run export-collections <release-directory>.');
const root = resolve(stage, 'collections');

process.chdir(fileURLToPath(new URL('../../web/', import.meta.url)));
const { loadKoleksi } = await import('../../web/src/lib/koleksi.ts');
const { citeId, lawPath, loadRegulationText } = await import('../../web/src/lib/peraturan.ts');
const { compareData, hasAmendmentSteps, versionHistory } = await import('../../web/src/lib/amendments.ts');
const { historyOf, versionRows } = await import('../../web/src/lib/versions.ts');
const { mergedDoc } = await import('../../web/src/lib/merge.ts');

type Collection = ReturnType<typeof loadKoleksi>[number];
type Merged = NonNullable<ReturnType<typeof mergedDoc>>;

function mergedRecord(collection: Collection, merged: Merged, versions: ReturnType<typeof versionRows>) {
  const { point, doc, unreadable, notes } = merged;
  return {
    date: point.date,
    base: { label: citeId(collection.base.id), href: `/${lawPath(collection.base)}` },
    amendments: (point.after ?? []).map(citeId),
    versions: versions.map(({ label, date, href, sub }) => ({ label, date, href, sub })),
    incomplete: point.complete === false || unreadable.size > 0,
    missing: point.missing_before ?? 0,
    unreadable: [...unreadable],
    unapplied: (point.not_applied ?? []).filter((entry) => entry.affects_wording).map((entry) => entry.header),
    notes: Object.fromEntries(notes),
    text: readerText(doc),
  };
}

async function writeJson(directory: string, name: string, record: unknown) {
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, name + '.json'), JSON.stringify(record));
}

async function exportCollection(collection: Collection, directory: string) {
  const document = loadRegulationText(collection.base);
  if (!document) return;
  if (hasAmendmentSteps(collection.base)) {
    const comparison = compareData(versionHistory(collection.base, document));
    await writeJson(directory, 'perubahan', comparison);
  }

  const points = historyOf(collection.base)?.points ?? [];
  const latest = points.at(-1);
  const versions = versionRows(collection);
  for (const point of points) {
    if (point.kind !== 'gabungan' || (point !== latest && !point.date)) continue;
    const merged = mergedDoc(collection, point.id);
    if (!merged) continue;
    const name = point === latest ? 'latest' : point.date;
    if (!name || !/^(?:latest|\d{4}-\d{2}-\d{2})$/.test(name)) {
      throw new Error(`Invalid collection version date: ${name}`);
    }
    await writeJson(directory, name, mergedRecord(collection, merged, versions));
  }
}

for (const collection of loadKoleksi()) {
  if (!/^[a-z0-9-]+$/.test(collection.slug)) throw new Error(`Invalid collection: ${collection.slug}`);
  await exportCollection(collection, join(root, collection.slug));
}
