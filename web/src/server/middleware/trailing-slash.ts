import type { StartMiddleware } from "@solidjs/vite-plugin";

const FILE_EXTENSION = /\.[^/]+$/u;
const SERVER_FUNCTIONS = "/_server";

export const trailingSlash: StartMiddleware = async (event, proceed) => {
  const url = new URL(event.request.url);

  if (
    event.request.method !== "GET" ||
    url.pathname.endsWith("/") ||
    FILE_EXTENSION.test(url.pathname) ||
    url.pathname.startsWith(SERVER_FUNCTIONS)
  ) {
    return await proceed();
  }

  return new Response(null, {
    status: 307,
    headers: { Location: `${url.pathname}/${url.search}` },
  });
};
