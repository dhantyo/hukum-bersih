import * as v from "valibot";

const LAW_PATH = String.raw`/uu/\d+/\d{4}/`;
const SLUG = "[a-z0-9-]+";
const DRAFT_DOCUMENT_ID = "[a-z0-9_-]+";
const DRAFT_PAIR = `${DRAFT_DOCUMENT_ID}\\.\\.\\.${DRAFT_DOCUMENT_ID}`;
const VERSION_DATE = String.raw`\d{4}-\d{2}-\d{2}`;

const matching = (source: string, flags = "u") =>
  v.pipe(v.string(), v.regex(new RegExp(`^${source}$`, flags)));

export const lawPath = matching(LAW_PATH);
export const year = matching(String.raw`\d{4}`);
export const slug = matching(SLUG);
export const draftDocumentId = matching(DRAFT_DOCUMENT_ID);
export const draftPair = matching(DRAFT_PAIR);
export const versionDate = matching(VERSION_DATE);
export const collectionVersion = matching(`(?:latest|${VERSION_DATE})`);

const compareTarget = v.union([v.literal(""), matching("[a-z0-9_-]+")]);

/** The two versions a collection page compares: `bandingkan` is the newer, `dari` the older. */
export const collectionCompare = v.object({
  bandingkan: v.optional(compareTarget),
  dari: v.optional(compareTarget),
});

export const internalLink = matching(
  `/[a-z-]+/[a-z0-9_-]+(?:/(?:\\d{4}|${VERSION_DATE}))?/`,
  "iu"
);

export const lawAnchorLink = matching(
  `${LAW_PATH}(?:\\?bandingkan=[a-z0-9_-]+)?(?:#[a-z0-9_.:%-]+)?`,
  "iu"
);

export const webLink = v.pipe(v.string(), v.url(), v.regex(/^https?:\/\//u));

export const searchHitLink = matching(
  "/(?:uu|koleksi|ruu)/[a-z0-9./_-]+(?:#[a-z0-9_.:%-]+)?",
  "iu"
);

export const collectionComparisonPath = matching(
  `/koleksi/${SLUG}/perubahan\\.json`
);

export const publicDocumentPath = v.union([
  matching(`${LAW_PATH}(?:perubahan/)?`),
  matching(`/koleksi/${SLUG}/(?:${VERSION_DATE}/)?`),
  matching(`/ruu/${SLUG}/${DRAFT_DOCUMENT_ID}/`),
  matching(`/ruu/${SLUG}/beda/${DRAFT_PAIR}/`),
]);

export const searchText = v.fallback(
  v.pipe(
    v.string(),
    v.trim(),
    v.transform((text) => text.slice(0, 200))
  ),
  ""
);

export const compareSearch = v.object({
  bandingkan: v.fallback(v.optional(v.string()), undefined),
  dari: v.fallback(v.optional(v.string()), undefined),
});

export const searchPage = v.object({ q: v.optional(searchText, "") });
