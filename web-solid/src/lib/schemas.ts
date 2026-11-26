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

const MAX_COLUMNS = 32;
const VERSION_ID = "[a-z0-9_-]+";

const compareVersions = v.union([
  v.pipe(
    v.string(),
    v.regex(new RegExp(`^(?:${VERSION_ID}(?:,${VERSION_ID})*)?$`, "u")),
    v.maxLength(1024)
  ),
  v.pipe(v.array(matching(VERSION_ID)), v.maxLength(MAX_COLUMNS)),
]);

/** The versions a page compares: `v` lists any number of them, one column each, left to right.
 * One version stands for it against the one before it; an empty `v` for the first against the
 * latest. */
export const compareRequest = v.object({ v: v.optional(compareVersions) });

export const internalLink = matching(
  `/[a-z-]+/[a-z0-9_-]+(?:/(?:\\d{4}|${VERSION_DATE}))?/`,
  "iu"
);

export const lawAnchorLink = matching(
  `${LAW_PATH}(?:\\?v=[a-z0-9_-]+)?(?:#[a-z0-9_.:%-]+)?`,
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
  matching(LAW_PATH),
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
  v: v.fallback(
    v.optional(v.union([v.string(), v.array(v.string())])),
    undefined
  ),
  pasal: v.fallback(v.optional(v.string()), undefined),
});

export const searchPage = v.object({ q: v.optional(searchText, "") });
