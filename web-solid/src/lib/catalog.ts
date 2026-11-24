import { GET } from '@solidjs/web/server-functions';
import { listLaws } from '../server/catalog';

export const getLawOverview = GET(async () => {
  'use server';
  const laws = await listLaws();
  const years = Map.groupBy(laws, (law) => law.y);
  return { total: laws.length, years: [...years].map(([year, items]) => ({ year, count: items.length })), recent: laws.slice(0, 20) };
});

export const getLawYear = GET(async (year: string) => {
  'use server';
  if (!/^\d{4}$/.test(year)) return [];
  return (await listLaws()).filter((law) => law.y === Number(year));
});
