import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [stage] = process.argv.slice(2);
if (!stage) throw new Error('Use pnpm run export-collections <release-directory>.');
const root = resolve(stage, 'collections');

process.chdir(fileURLToPath(new URL('../../web/', import.meta.url)));
const { loadKoleksi } = await import('../../web/src/lib/koleksi.ts');
const { loadRegulationText } = await import('../../web/src/lib/peraturan.ts');
const { compareData, hasAmendmentSteps, versionHistory } = await import('../../web/src/lib/amendments.ts');

for (const collection of loadKoleksi()) {
  if (!/^[a-z0-9-]+$/.test(collection.slug)) throw new Error(`Invalid collection: ${collection.slug}`);
  if (!hasAmendmentSteps(collection.base)) continue;
  const document = loadRegulationText(collection.base);
  if (!document) continue;

  const directory = join(root, collection.slug);
  await mkdir(directory, { recursive: true });
  const comparison = compareData(versionHistory(collection.base, document));
  await writeFile(join(directory, 'perubahan.json'), JSON.stringify(comparison));
}
