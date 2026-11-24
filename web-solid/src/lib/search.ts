import { GET } from '@solidjs/web/server-functions';
import { readActiveRelease } from '../server/corpus';

export const getSearchRelease = GET(async () => {
  'use server';
  return readActiveRelease();
});
