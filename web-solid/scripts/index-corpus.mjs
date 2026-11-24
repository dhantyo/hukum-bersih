import { glob, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { handleRequest } from '../dist/server/server.js';

const [releaseDirectory] = process.argv.slice(2);
if (!releaseDirectory) throw new Error('Usage: pnpm run index-corpus <release-directory>');

async function renderLaw(site, file) {
  const path = `/${file.slice(0, -'index.json'.length)}`;
  const corpus = {
    async get(key) {
      if (key === 'active-release') return new Response('staging');
      if (key !== `releases/staging/laws${path}index.json`) return null;
      return new Response(await readFile(join(releaseDirectory, 'laws', file)));
    },
  };
  const response = await handleRequest(new Request(`https://index.invalid${path}`), {
    event: { locals: { corpus } },
  });
  if (!response.ok) throw new Error(`Could not render ${path}: ${response.status}`);
  const destination = join(site, dirname(file), 'index.html');
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, await response.text());
}

function runPagefind(site, output) {
  const pagefind = spawnSync('pagefind', ['--site', site, '--output-path', output], { stdio: 'inherit' });
  if (pagefind.error) throw pagefind.error;
  if (pagefind.status !== 0) throw new Error(`Pagefind exited with status ${pagefind.status}`);
}

const site = await mkdtemp(join(tmpdir(), 'hukum-pagefind-'));
const scratch = await mkdtemp(join(resolve(releaseDirectory), '.pagefind-'));
try {
  let count = 0;
  for await (const file of glob('uu/*/*/index.json', { cwd: join(releaseDirectory, 'laws') })) {
    await renderLaw(site, file);
    count++;
  }
  if (!count) throw new Error('The release has no law documents to index');
  runPagefind(site, scratch);
  await rename(scratch, resolve(releaseDirectory, 'pagefind'));
} finally {
  await rm(scratch, { recursive: true, force: true });
  await rm(site, { recursive: true, force: true });
}
