import type { AknNode, ReaderText } from "../server/records/reader-text.ts";
import { byNumber } from "./compare.ts";
import type { CompareRow, Comparison } from "./compare.ts";
import { pasalKey } from "./display.ts";
import { isPresent } from "./text.ts";

/** A pasal of the compared span that reads the same in every column. */
export interface UnchangedPasal {
  num: string;
  key: string;
  node: AknNode;
}

/** One stop in the comparison, in pasal order: a pasal that differs, or a run of neighbouring
 * pasal that do not. */
export type SpanEntry =
  | { kind: "changed"; row: CompareRow }
  | { kind: "same"; pasal: UnchangedPasal[] };

/** Where the text of the unchanged pasal comes from: the text the page already shows, another
 * version of the collection, or the first version's own law. */
export type TextSource =
  | { from: "page" }
  | { from: "collection"; version: string }
  | { from: "law"; path: string };

/** A version the page lists, as the collection record gives it. */
export interface ListedVersion {
  date: string | null;
  href?: string;
}

const LATEST = "latest";
const RANGE_DASH = "–";

const articlesOf = (nodes: readonly AknNode[]) => {
  const found: AknNode[] = [];

  const visit = (list: readonly AknNode[]) => {
    for (const node of list) {
      if (node.tag === "article") {
        found.push(node);
      } else {
        visit(node.children);
      }
    }
  };

  visit(nodes);

  return found;
};

const unchangedIn = (text: ReaderText, rows: readonly CompareRow[]) => {
  const changed = new Set(rows.map((row) => row.num));
  const seen = new Set<string>();

  return articlesOf(text.body).flatMap((node) => {
    const { num } = node;

    if (!isPresent(num) || changed.has(num) || seen.has(num)) {
      return [];
    }

    seen.add(num);

    return [{ num, key: pasalKey(num), node } satisfies UnchangedPasal];
  });
};

const entryNum = (entry: SpanEntry) =>
  entry.kind === "changed" ? entry.row.num : (entry.pasal[0]?.num ?? "");

const inPasalOrder = (entries: readonly SpanEntry[]) =>
  entries.toSorted((x, y) => byNumber(entryNum(x), entryNum(y)));

const joinRuns = (entries: readonly SpanEntry[]) => {
  const joined: SpanEntry[] = [];

  for (const entry of entries) {
    const last = joined.at(-1);

    if (entry.kind === "same" && last?.kind === "same") {
      last.pasal.push(...entry.pasal);
    } else {
      joined.push(
        entry.kind === "same"
          ? { kind: "same", pasal: [...entry.pasal] }
          : entry
      );
    }
  }

  return joined;
};

/**
 * Every pasal of the compared span in order: the changed `rows` as they are, and the pasal of
 * `text` (the text of one of the compared versions) that no row names, gathered into runs of
 * neighbours. `pasal` narrows both to one number ("" keeps all). Without `text` only the rows
 * remain.
 */
export const spanEntries = (
  rows: readonly CompareRow[],
  text: ReaderText | undefined,
  pasal: string
) => {
  const wanted = (num: string) => pasal === "" || num.toUpperCase() === pasal;

  const changed = rows.flatMap((row) =>
    wanted(row.num) ? [{ kind: "changed", row } satisfies SpanEntry] : []
  );

  const same = (text === undefined ? [] : unchangedIn(text, rows)).flatMap(
    (entry) =>
      wanted(entry.num)
        ? [{ kind: "same", pasal: [entry] } satisfies SpanEntry]
        : []
  );

  return joinRuns(inPasalOrder([...changed, ...same]));
};

/** "Pasal 76", or "Pasal 76–80" for a run. */
export const runName = (pasal: readonly UnchangedPasal[]) => {
  const first = pasal[0]?.num ?? "";
  const last = pasal.at(-1)?.num ?? first;

  return first === last
    ? `Pasal ${first}`
    : `Pasal ${first}${RANGE_DASH}${last}`;
};

const versionOfHref = (slug: string, href: string) => {
  const collection = `/koleksi/${slug}/`;

  if (href.startsWith(collection)) {
    return {
      from: "collection",
      version: href.slice(collection.length).replace(/\/$/u, "") || LATEST,
    } satisfies TextSource;
  }

  return href.startsWith("/uu/")
    ? ({ from: "law", path: href } satisfies TextSource)
    : undefined;
};

/**
 * Which text holds the unchanged pasal. Any chosen version will do, because a pasal no row names
 * reads the same in all of them: the page's own text when its version is a column (nothing to
 * load), else the newest column's version, found in the versions the page lists by date.
 * Undefined when the columns' versions have no text to read.
 */
export const textSource = (
  slug: string,
  comparison: Pick<Comparison, "chosen" | "versions">,
  pageDate: string | null,
  listed: readonly ListedVersion[]
) => {
  const columns = comparison.versions.filter((version) =>
    comparison.chosen.includes(version.id)
  );

  if (
    isPresent(pageDate) &&
    columns.some((version) => version.date === pageDate)
  ) {
    return { from: "page" } satisfies TextSource;
  }

  const newest = columns.at(-1);

  const entry = listed.find(
    (version) => isPresent(newest?.date) && version.date === newest.date
  );

  return isPresent(entry?.href) ? versionOfHref(slug, entry.href) : undefined;
};
