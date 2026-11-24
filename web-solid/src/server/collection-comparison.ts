import * as v from 'valibot';
import type { StartMiddleware } from '@solidjs/vite-plugin';
import { readActiveRelease, readReleaseObject } from './corpus';

const version = v.object({
  id: v.string(),
  label: v.string(),
  cite: v.string(),
  date: v.nullable(v.string()),
  gap: v.number(),
});
const line = v.tuple([v.nullable(v.string()), v.string(), v.number()]);
const slot = v.nullable(v.union([v.literal('d'), v.literal('u'), v.array(line)]));
const comparison = v.object({
  versions: v.array(version),
  pasal: v.array(v.tuple([v.string(), v.array(v.tuple([v.number(), slot]))])),
});

export const collectionComparison: StartMiddleware = async (event, next) => {
  const path = new URL(event.request.url).pathname;
  const route = /^\/koleksi\/([a-z0-9-]+)\/perubahan\.json$/.exec(path);
  if (event.request.method !== 'GET' || !route) return next();

  const file = await readReleaseObject(await readActiveRelease(), `collections/${route[1]}/perubahan.json`);
  if (!file) return new Response(null, { status: 404 });
  const body = await file.text();
  v.parse(comparison, JSON.parse(body));
  return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
};
