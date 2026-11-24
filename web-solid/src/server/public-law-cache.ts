import type { StartMiddleware } from '@solidjs/vite-plugin';
import { readActiveRelease } from './corpus';

declare module '@solidjs/web' {
  interface RequestEventLocals {
    publicPages?: {
      version: string;
      cache: Pick<Cache, 'match' | 'put'>;
      defer(task: Promise<void>): void;
    };
  }
}

function isPublicLawRequest(request: Request, url: URL) {
  return request.method === 'GET' && !url.search &&
    /^\/uu\/\d+\/\d{4}\/(?:perubahan\/)?$/.test(url.pathname) &&
    request.headers.get('Accept')?.includes('text/html') &&
    ['Cookie', 'Authorization', 'Range', 'If-None-Match', 'If-Modified-Since'].every(
      (header) => !request.headers.has(header),
    );
}

function cacheable(response: Response) {
  const directives = response.headers.get('Cache-Control');
  return response.status === 200 && !response.headers.has('Set-Cookie') &&
    !response.headers.has('Vary') && !/private|no-store/i.test(directives ?? '') &&
    response.headers.get('Content-Type')?.startsWith('text/html');
}

export const publicLawCache: StartMiddleware = async (event, next) => {
  const options = event.locals.publicPages;
  const url = new URL(event.request.url);
  if (!options || !isPublicLawRequest(event.request, url)) return next();

  const release = await readActiveRelease();
  url.searchParams.set('__hukum_release', release);
  url.searchParams.set('__hukum_worker', options.version);
  const key = new Request(url);
  const cached = await options.cache.match(key);
  if (cached) {
    const response = new Response(cached.body, cached);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  const response = await next();
  if (cacheable(response)) {
    const copy = response.clone();
    copy.headers.set('Cache-Control', 'public, max-age=86400');
    options.defer(options.cache.put(key, copy).catch((error: unknown) => {
      console.error('Public law cache write failed', error);
    }));
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
};
