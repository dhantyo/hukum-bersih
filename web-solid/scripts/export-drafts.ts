import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readerText } from './reader-text.ts';

const [stage] = process.argv.slice(2);
if (!stage) throw new Error('Use pnpm run export-drafts <release-directory>.');
const root = resolve(stage, 'drafts');

process.chdir(fileURLToPath(new URL('../../web/', import.meta.url)));
const { loadRuus, loadText, versions } = await import('../../web/src/lib/data.ts');

type Draft = ReturnType<typeof loadRuus>[number];

function documentMetadata(document: Draft['documents'][number]) {
  const { id, type, label, date, provenance, obtained_by, source_url, archive_url, note, ruu_title } = document;
  return { id, type, label, date, provenance, obtained_by, source_url, archive_url, note, ruu_title, hasText: Boolean(document.text) };
}

async function exportDraft(bill: Draft) {
  if (!/^[a-z0-9-]+$/.test(bill.slug)) throw new Error(`Invalid draft slug: ${bill.slug}`);
  const directory = join(root, bill.slug);
  await mkdir(join(directory, 'documents'), { recursive: true });
  const name = bill.short_name ?? bill.title;
  const record = { ...bill, name, documents: bill.documents.map(documentMetadata) };
  await writeFile(join(directory, 'index.json'), JSON.stringify(record));

  for (const document of versions(bill)) {
    if (!/^[a-z0-9_-]+$/.test(document.id)) throw new Error(`Invalid draft document: ${document.id}`);
    const text = readerText(loadText(bill, document));
    const exported = { name, title: bill.title, document: documentMetadata(document), text };
    await writeFile(join(directory, 'documents', document.id + '.json'), JSON.stringify(exported));
  }
}

for (const bill of loadRuus()) await exportDraft(bill);
