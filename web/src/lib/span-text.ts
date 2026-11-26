import { createMemo } from "solid-js";

import type { ReaderText } from "../server/records/reader-text.ts";
import { textSource } from "./compare-span.ts";
import type { ListedVersion } from "./compare-span.ts";
import type { Comparison } from "./compare.ts";
import { collectionQuery, lawQuery } from "./queries.ts";

interface SpanTextInput {
  slug: string;
  comparison: Comparison | null;
  pageDate: string | null;
  pageText: ReaderText;
  listed: readonly ListedVersion[];
}

const readSource = async (
  input: SpanTextInput,
  source: NonNullable<ReturnType<typeof textSource>>
) => {
  if (source.from === "page") {
    return input.pageText;
  }

  if (source.from === "collection") {
    const collection = await collectionQuery(input.slug, source.version);

    return collection?.merged?.text;
  }

  const law = await lawQuery(source.path);

  return law?.text ?? undefined;
};

/**
 * The text that holds the pasal a comparison leaves unchanged: the page's own when its version
 * is a column, else one more record (a collection version or a law), read once per version.
 * Undefined when there is no comparison or its columns have no text to read.
 */
export const useSpanText = (input: () => SpanTextInput) =>
  createMemo(async () => {
    const asked = input();

    const source =
      asked.comparison === null
        ? undefined
        : textSource(
            asked.slug,
            asked.comparison,
            asked.pageDate,
            asked.listed
          );

    return source === undefined ? undefined : await readSource(asked, source);
  });
