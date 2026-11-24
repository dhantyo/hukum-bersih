import * as v from 'valibot';
import { readActiveRelease, readReleaseObject } from './corpus';

const catalogPath = v.pipe(v.string(), v.regex(/^\/[a-z-]+\/[a-z0-9_-]+(?:\/\d{4})?\/$/i));
const entry = v.object({
  id: v.string(),
  s: v.nullable(v.string()),
  c: v.string(),
  t: v.string(),
  n: v.string(),
  y: v.number(),
  st: v.optional(v.nullable(v.string())),
  m: v.array(v.string()),
  k: v.number(),
  u: catalogPath,
});

const collection = v.object({
  slug: v.string(),
  name: v.string(),
  named: v.boolean(),
  t: v.string(),
  a: v.array(v.string()),
  k: v.number(),
  u: catalogPath,
  mem: v.array(v.tuple([v.string(), v.string()])),
});

const catalog = v.object({ laws: v.array(entry), koleksi: v.array(collection) });

async function loadCatalog() {
  const file = await readReleaseObject(await readActiveRelease(), 'law-catalog.json');
  if (!file) throw new Error('The active release has no law catalog');
  return await file.text();
}

export async function listLaws() {
  const { laws } = v.parse(catalog, JSON.parse(await loadCatalog()));
  return laws.filter((law) => /^\/uu\/\d+\/\d{4}\/$/.test(law.u));
}

export type LawCatalogEntry = v.InferOutput<typeof entry>;

export async function catalogResponse() {
  const body = await loadCatalog();
  // Validate the published object before exposing the original JSON contract.
  v.parse(catalog, JSON.parse(body));
  return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
