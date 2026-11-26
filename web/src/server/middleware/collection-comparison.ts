import type { StartMiddleware } from "@solidjs/vite-plugin";
import * as v from "valibot";

import { collectionComparisonPath } from "../../lib/schemas.ts";
import { readCollectionHistoryJson } from "../records/collection-history.ts";

export const collectionComparison: StartMiddleware = async (event, proceed) => {
  const { pathname } = new URL(event.request.url);

  if (
    event.request.method !== "GET" ||
    !v.is(collectionComparisonPath, pathname)
  ) {
    return await proceed();
  }

  const segments = pathname.split("/");
  const body = await readCollectionHistoryJson(segments[2]);

  if (body === null) {
    return new Response(null, { status: 404 });
  }

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
