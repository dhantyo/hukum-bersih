import type { StartMiddleware } from "@solidjs/vite-plugin";
import * as v from "valibot";

import { catalogFilePath, comparisonFilePath } from "../../lib/schemas.ts";
import { readReleaseObject } from "../corpus.ts";

const IMMUTABLE = "public, max-age=31536000, immutable";
const PATH_RELEASE = 2;
const PATH_SLUG = 4;
const PATH_FILE = 6;

const releaseObjectOf = (pathname: string) => {
  const parts = pathname.split("/");

  if (v.is(comparisonFilePath, pathname)) {
    return {
      release: parts[PATH_RELEASE],
      key: `collections/${parts[PATH_SLUG]}/comparisons/${parts[PATH_FILE]}`,
    };
  }

  return v.is(catalogFilePath, pathname)
    ? { release: parts[PATH_RELEASE], key: "law-catalog.json" }
    : undefined;
};

const isUnchanged = (request: Request, etag: string) =>
  request.headers
    .get("If-None-Match")
    ?.split(",")
    .some((candidate) => candidate.trim() === etag) === true;

/**
 * The published comparison files and the law catalog of a release, straight from the corpus to
 * the browser, so the browser can build the rows of a comparison and search the catalog itself. The address names the release, so a file
 * never changes and is cached for good; the bytes are passed on as a stream and never parsed.
 */
export const releaseData: StartMiddleware = async (event, proceed) => {
  const { request } = event;
  const { pathname } = new URL(request.url);

  const wanted = releaseObjectOf(pathname);

  if (wanted === undefined) {
    return await proceed();
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const file = await readReleaseObject(wanted.release, wanted.key);

  if (file === null) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const headers = {
    "Cache-Control": IMMUTABLE,
    ETag: file.httpEtag,
  };

  if (isUnchanged(request, file.httpEtag)) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(request.method === "HEAD" ? null : file.body, {
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
};
