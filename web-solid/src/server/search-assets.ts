import type { StartMiddleware } from "@solidjs/vite-plugin";

import { readReleaseObject, releaseIdPattern } from "./corpus";

const contentTypes: Record<string, string> = {
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json",
  wasm: "application/wasm",
  gz: "application/octet-stream",
};

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
    !parts.length ||
    !parts.every((part) => /^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/.test(part))
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
        "Content-Type": contentTypes[extension] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    }
  );
};
