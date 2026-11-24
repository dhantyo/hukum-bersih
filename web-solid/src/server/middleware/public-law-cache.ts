import type { StartMiddleware } from "@solidjs/vite-plugin";
import * as v from "valibot";

import { publicDocumentPath } from "../../lib/schemas.ts";
import { readActiveRelease } from "../corpus.ts";

declare module "@solidjs/web" {
  interface RequestEventLocals {
    publicPages?: {
      version: string;
      cache: Pick<Cache, "match" | "put">;
      defer: (task: Promise<void>) => void;
    };
  }
}

const uncacheableRequestHeaders = [
  "Cookie",
  "Authorization",
  "Range",
  "If-None-Match",
  "If-Modified-Since",
];

const isPublicLawRequest = (request: Request, url: URL) =>
  request.method === "GET" &&
  url.search === "" &&
  v.is(publicDocumentPath, url.pathname) &&
  request.headers.get("Accept")?.includes("text/html") === true &&
  uncacheableRequestHeaders.every((header) => !request.headers.has(header));

const cacheable = (response: Response) => {
  const directives = response.headers.get("Cache-Control");

  return (
    response.status === 200 &&
    !response.headers.has("Set-Cookie") &&
    !response.headers.has("Vary") &&
    !/private|no-store/iu.test(directives ?? "") &&
    response.headers.get("Content-Type")?.startsWith("text/html") === true
  );
};

export const publicLawCache: StartMiddleware = async (event, next) => {
  const options = event.locals.publicPages;
  const url = new URL(event.request.url);

  if (!options || !isPublicLawRequest(event.request, url)) {
    return await next();
  }

  const release = await readActiveRelease();
  url.searchParams.set("__hukum_release", release);
  url.searchParams.set("__hukum_worker", options.version);
  const key = new Request(url);
  const cached = await options.cache.match(key);

  if (cached) {
    const response = new Response(cached.body, cached);
    response.headers.set("Cache-Control", "no-store");

    return response;
  }

  const response = await next();

  if (cacheable(response)) {
    const copy = response.clone();
    copy.headers.set("Cache-Control", "public, max-age=86400");
    options.defer(
      options.cache.put(key, copy).catch((error: unknown) => {
        console.error("Public law cache write failed", error);
      })
    );
    response.headers.set("Cache-Control", "no-store");
  }

  return response;
};
