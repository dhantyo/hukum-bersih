import { GET } from '@solidjs/web/server-functions';
import { parseComparisonRecord } from '../amendment-record';
import { parseLawRecord } from '../law-record';
import { readLawObject } from '../server/corpus';

function isLawPath(path: string) {
  return /^\/uu\/\d+\/\d{4}\/$/.test(path);
}

export const getLaw = GET(async (path: string, compareTo?: string, compareFrom?: string) => {
  'use server';
  if (!isLawPath(path)) return null;
  const publishedLaw = await readLawObject(path);
  if (publishedLaw === null) return null;
  const law = parseLawRecord(publishedLaw, path);
  if (compareTo === undefined) return { law };
  if (!law.hasAmendments || compareFrom !== undefined) return { law, comparisonRequested: true };

  const { amendments } = parseComparisonRecord(publishedLaw, path);
  const amendment = compareTo === ''
    ? amendments.at(-1)
    : amendments.find((entry) => entry.id === compareTo);
  return { law, amendment, comparisonRequested: true };
});

export const getLawComparison = GET(async (path: string) => {
  'use server';
  if (!isLawPath(path)) return null;
  const publishedLaw = await readLawObject(path);
  if (publishedLaw === null) return null;
  const comparison = parseComparisonRecord(publishedLaw, path);
  return comparison.amendments.length > 0 ? comparison : null;
});
