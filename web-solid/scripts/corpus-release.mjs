import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, glob, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [command, argument] = process.argv.slice(2);
const localRoot = process.env.HUKUM_CORPUS_DIR;
const r2Remote = process.env.HUKUM_CORPUS_REMOTE;
const readyFile = 'release-id';
if (!argument || !['publish', 'activate'].includes(command) || Boolean(localRoot) === Boolean(r2Remote)) {
  throw new Error('Use publish <indexed-directory> or activate <release-id> with either HUKUM_CORPUS_DIR or HUKUM_CORPUS_REMOTE.');
}

const releaseIdPattern = /^[a-f0-9]{64}$/;

async function validateRelease(directory) {
  const laws = glob('laws/uu/*/*/index.json', { cwd: directory });
  if ((await laws.next()).done) throw new Error('The release contains no law documents');
  await laws.return();
  const entry = JSON.parse(await readFile(join(directory, 'pagefind/pagefind-entry.json'), 'utf8'));
  await readFile(join(directory, 'pagefind/pagefind.js'));
  if (!Object.values(entry.languages ?? {}).some((language) => language.page_count > 0)) {
    throw new Error('The release has no searchable Pagefind documents');
  }
}

async function releaseDigest(directory) {
  const entries = await Array.fromAsync(glob('**/*', { cwd: directory, withFileTypes: true }));
  const files = entries.filter((entry) => !entry.isDirectory());
  if (files.some((entry) => !entry.isFile())) throw new Error('Release contents must be regular files');
  const keys = files.map((entry) => join(entry.parentPath, entry.name).slice(directory.length + 1)).sort();
  const hash = createHash('sha256');
  for (const key of keys) {
    const checksum = createHash('sha256').update(await readFile(join(directory, key))).digest('hex');
    hash.update(JSON.stringify([key, checksum]) + '\n');
  }
  return hash.digest('hex');
}

function rclone(...args) {
  return execFileSync('rclone', args, { encoding: 'utf8' });
}

async function storeRelease(directory, release) {
  if (r2Remote) {
    const prefix = `${r2Remote}/releases/${release}`;
    rclone('copy', directory, prefix, '--immutable', '--exclude', `/${readyFile}`);
    rclone('copyto', join(directory, readyFile), `${prefix}/${readyFile}`, '--immutable');
    return;
  }

  const destination = join(localRoot, 'releases', release);
  await mkdir(join(localRoot, 'releases'), { recursive: true });
  try {
    await rename(directory, destination);
  } catch (error) {
    if (error?.code !== 'EEXIST' && error?.code !== 'ENOTEMPTY') throw error;
    await assertReleaseReady(release);
  }
}

async function assertReleaseReady(release) {
  if (!releaseIdPattern.test(release)) throw new Error(`Invalid release ID: ${release}`);
  const key = `releases/${release}/${readyFile}`;
  const marker = r2Remote ? rclone('cat', `${r2Remote}/${key}`) : await readFile(join(localRoot, key), 'utf8');
  if (marker.trim() !== release) throw new Error(`Release ${release} is incomplete`);
}

async function activateRelease(scratch, release) {
  await assertReleaseReady(release);
  const pointer = join(scratch, 'active-release');
  await writeFile(pointer, `${release}\n`, { flag: 'wx' });
  if (r2Remote) rclone('copyto', pointer, `${r2Remote}/active-release`, '--ignore-times');
  else await rename(pointer, join(localRoot, 'active-release'));
}

async function publishRelease(scratch, source) {
  const directory = join(scratch, 'release');
  await mkdir(directory);
  await Promise.all(['laws', 'pagefind', 'law-catalog.json'].map((group) =>
    cp(join(source, group), join(directory, group), { recursive: true })));
  await validateRelease(directory);
  const release = await releaseDigest(directory);
  await writeFile(join(directory, readyFile), `${release}\n`, { flag: 'wx' });
  await storeRelease(directory, release);
  return release;
}

const stagingRoot = localRoot ? resolve(localRoot) : tmpdir();
await mkdir(stagingRoot, { recursive: true });
const scratch = await mkdtemp(join(stagingRoot, '.corpus-release-'));
try {
  const release = command === 'publish' ? await publishRelease(scratch, resolve(argument)) : argument;
  await activateRelease(scratch, release);
  process.stdout.write(`${release}\n`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
