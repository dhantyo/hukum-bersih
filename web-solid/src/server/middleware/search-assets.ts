import type { StartMiddleware } from "@solidjs/vite-plugin";

import { readReleaseObject, releaseIdPattern } from "../corpus.ts";

const assetPartPattern = /^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/u;

const contentTypes = new Map([
  ["js", "text/javascript; charset=utf-8"],
  ["css", "text/css; charset=utf-8"],
  ["json", "application/json"],
  ["wasm", "application/wasm"],
]);

const contentTypeOf = (extension: string) =>
  contentTypes.get(extension) ?? "application/octet-stream";

export const searchAssets: StartMiddleware = async (event, next) => {
  const { pathname } = new URL(event.request.url);

  if (!pathname.startsWith("/search-index/")) {
    return await next();
  }

  if (event.request.method !== "GET" && event.request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const [, , release, ...parts] = pathname.split("/");

  if (
    !releaseIdPattern.test(release) ||
    parts.length === 0 ||
    !parts.every((part) => assetPartPattern.test(part))
  ) {
    return new Response(null, { status: 404 });
  }

  const file = await readReleaseObject(release, `pagefind/${parts.join("/")}`);

  if (!file) {
    return new Response(null, { status: 404 });
  }

  const extension = parts.at(-1)?.split(".").at(-1) ?? "";

  return new Response(
    event.request.method === "HEAD" ? null : await file.arrayBuffer(),
    {
      headers: {
        "Content-Type": contentTypeOf(extension),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    }
  );
};
