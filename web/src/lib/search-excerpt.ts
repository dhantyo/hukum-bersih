import { norm } from "./search-query.ts";

interface ExcerptPart {
  text: string;
  marked: boolean;
}

const MARK = /<\/?mark>/u;
const MARKED = /<mark>(?<word>.*?)<\/mark>/gu;

const REPEATED_HEADING =
  /^\s*(?:<mark>)?(?:Pasal|BAB|Bagian)(?:<\/mark>)?\s+(?:<mark>)?[0-9A-Za-z]+(?:<\/mark>)?\.?\s*/u;

const MIN_PARTIAL = 3;

const ENTITIES = new Map([
  ["&amp;", "&"],
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&quot;", '"'],
  ["&#39;", "'"],
  ["&#x27;", "'"],
]);

const ENTITY = /&(?:amp|lt|gt|quot|#39|#x27);/gu;

const decode = (text: string) =>
  text.replaceAll(ENTITY, (entity) => ENTITIES.get(entity) ?? entity);

/** Pagefind escapes the text of an excerpt and adds only `<mark>`: split it into plain and marked parts. */
export const excerptParts = (html: string) => {
  const parts: ExcerptPart[] = [];
  let marked = false;

  for (const piece of html.split(/(?<tag><\/?mark>)/u)) {
    if (MARK.test(piece)) {
      marked = piece === "<mark>";
    } else if (piece !== "") {
      parts.push({ text: decode(piece), marked });
    }
  }

  return parts;
};

export const withoutHeading = (html: string) =>
  html.replace(REPEATED_HEADING, "");

const markedWords = (html: string) =>
  [...html.matchAll(MARKED)].flatMap((match) => {
    const word = norm(match.groups?.word ?? "");

    return word === "" ? [] : [word];
  });

const sameWord = (marked: string, word: string) =>
  marked === word ||
  (marked.length >= MIN_PARTIAL &&
    (word.includes(marked) || marked.includes(word)));

/**
 * Pagefind falls back to the longest known prefix of a word it has not indexed ("xyzqq" finds
 * "x"). A result is real when one of its highlighted words is one of the query words.
 */
export const isRelated = (excerpt: string, queryWords: string[]) =>
  queryWords.length === 0 ||
  markedWords(excerpt).some((marked) =>
    queryWords.some((word) => sameWord(marked, word))
  );

/** The words of a query that say what to find: "uu" and "pasal" are on nearly every record. */
export const searchWords = (query: string) =>
  norm(query)
    .split(" ")
    .filter((word) => word !== "" && word !== "uu" && word !== "pasal");

const LAW_URL = /^\/uu\/(?<number>\d+)\/(?<year>\d{4})\//u;

/** "/uu/3/2011/" with "Transfer Dana" -> "UU 3/2011 tentang Transfer Dana", as the catalog names a law. */
export const hitTitle = (url: string, title: string) => {
  const found = LAW_URL.exec(url)?.groups;

  return found === undefined
    ? title
    : `UU ${found.number}/${found.year} tentang ${title}`;
};
