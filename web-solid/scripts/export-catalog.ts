import { glob, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [stage] = process.argv.slice(2);
if (!stage) throw new Error('Use pnpm run export-catalog <release-directory>.');
const destination = resolve(stage);
process.chdir(fileURLToPath(new URL('../../web/', import.meta.url)));
const { searchCatalog } = await import('../../web/src/lib/search-catalog.ts');

const files = await Array.fromAsync(glob('uu/*/*/index.json', { cwd: join(destination, 'laws') }));
if (!files.length) throw new Error('The release contains no exported law documents');
const paths = new Set(files.map((file) => `/${file.slice(0, -'index.json'.length)}`));
const catalog = searchCatalog('/');
const complete = catalog.laws.filter((law) => law.u.startsWith('/uu/')).every((law) => paths.has(law.u));
const published = complete ? catalog : {
  laws: catalog.laws.filter((law) => paths.has(law.u)),
  koleksi: [],
};
await writeFile(join(destination, 'law-catalog.json'), JSON.stringify(published) + '\n');
