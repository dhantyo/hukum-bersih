import type {
  CollectionVersions,
  PairPasal,
  PasalState,
  VersionPair,
} from "../server/records/collection-comparison.ts";
import type { DiffLine, DiffPart } from "../server/records/diff-line.ts";
import type { ReaderText } from "../server/records/reader-text.ts";
import { pasalKey } from "./display.ts";
import { isPresent } from "./text.ts";

/** How a piece of a changed ayat is shown: kept, inserted, struck, reworded (old or new side),
 * repealed ("gone") or absent from that version ("none"). */
export interface Piece {
  kind: "same" | "ins" | "del" | "gone" | "modOld" | "modNew" | "none";
  value: string;
}

/** One ayat, huruf or angka as one column shows it. */
export interface CompareLine {
  kind: DiffLine["kind"];
  indent: number;
  num?: string;
  pieces: Piece[];
}

/** One pasal in one column: how it stands in that version and the lines it shows. A column
 * with no text for the pasal still has a blank line for each line its neighbour has, so two
 * columns stay level. */
export interface CompareCell {
  state: PasalState;
  lines: CompareLine[];
}

export type Mark = "ins" | "del" | "mod";

export interface CompareRow {
  num: string;
  key: string;
  /** What happened to the pasal between the oldest and the newest of the columns. */
  mark: Mark;
  /** Where a column has no text for the pasal, and why. */
  note: string;
  /** One cell per column, left to right. With two columns the lines of both sides are paired
   * by number first, so line `i` of one cell sits beside line `i` of the other. */
  cells: CompareCell[];
  /** Two columns only: both sides merged into one run of lines, for a place too narrow for two. */
  merged?: CompareLine[];
}

export interface VersionChoice {
  id: string;
  label: string;
  cite: string;
  date: string | null;
}

export interface Comparison {
  versions: VersionChoice[];
  /** The address asked for a comparison (`?v`), whether or not it could be shown. */
  requested: boolean;
  /** The address named a version the collection does not have. */
  unknown: boolean;
  /** Ids of the columns, left to right; empty unless a comparison is shown. */
  chosen: string[];
  /** The pasal that differ between neighbouring columns, in number order. */
  rows: CompareRow[];
  /** Amendments between the first and last version shown that the collection does not record. */
  gap: number;
}

/** What a law page makes of a comparison: only the pasal its text has, and where each pasal it
 * lacks goes (after the pasal before it, by that pasal's eId). */
export interface LawComparison extends Comparison {
  after: Record<string, string[]>;
}

export interface ColumnSelection {
  requested: boolean;
  unknown: boolean;
  /** Indexes into the versions, one per column. */
  columns: readonly number[];
}

/** The `v` of the search: a comma list, or the field repeated by a GET form. */
export interface CompareRequest {
  v?: string | string[];
}

const SEPARATOR = ",";
const REPEALED = /^dihapus\.?$/iu;
const NUMBER = /^(?<digits>\d+)(?<suffix>[A-Za-z]*)$/u;

/** The request a server function is asked for. Its arguments travel as JSON, which cannot carry
 * `undefined`, so a choice not made is left out. */
export const comparisonRequest = ({ v }: CompareRequest) =>
  v === undefined ? ({} satisfies CompareRequest) : { v };

const notAsked = {
  requested: false,
  unknown: false,
  columns: [],
} satisfies ColumnSelection;

/** The address named something that is not a version, or the request was not valid. */
export const unknownSelection = {
  requested: true,
  unknown: true,
  columns: [],
} satisfies ColumnSelection;

const shown = (columns: number[]) =>
  ({ requested: true, unknown: false, columns }) satisfies ColumnSelection;

const adjacent = (index: number, count: number) => {
  if (index < 0 || count < 2) {
    return unknownSelection;
  }

  return shown(index === 0 ? [0, 1] : [index - 1, index]);
};

/**
 * Which versions the address asks for, one column each, left to right (`?v=a,b,c`). A single
 * version stands for that version against the one before it (the first against the next); `?v`
 * with nothing in it stands for the first version against the latest.
 */
export const pickColumns = (ids: string[], request: CompareRequest) => {
  if (request.v === undefined) {
    return notAsked;
  }

  const named = [request.v]
    .flat()
    .flatMap((entry) => entry.split(SEPARATOR))
    .filter((id) => id !== "");

  const columns = named.map((id) => ids.indexOf(id));

  if (columns.includes(-1)) {
    return unknownSelection;
  }

  if (columns.length === 0) {
    return ids.length > 1 ? shown([0, ids.length - 1]) : unknownSelection;
  }

  return columns.length === 1
    ? adjacent(columns[0], ids.length)
    : shown(columns);
};

const number = (num: string) => NUMBER.exec(num)?.groups;

/** Pasal numbers in reading order: 5, 5A, 5B, 6, 17. */
export const byNumber = (x: string, y: string) => {
  const a = number(x);
  const b = number(y);

  return (
    Number(a?.digits) - Number(b?.digits) ||
    (a?.suffix ?? "").localeCompare(b?.suffix ?? "") ||
    x.localeCompare(y)
  );
};

const textOf = (line: DiffLine, side: "a" | "b") =>
  line.parts
    .filter((part) => !(side === "a" ? part.added : part.removed))
    .map((part) => part.value)
    .join("");

const pieces = (parts: DiffPart[]) => {
  const out: Piece[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const next = parts[index + 1];

    if (part.removed && next?.added) {
      out.push(
        { kind: "modOld", value: part.value },
        { kind: "modNew", value: next.value }
      );
      index += 1;
    } else if (part.added) {
      out.push({ kind: "ins", value: part.value });
    } else if (part.removed) {
      out.push({ kind: "del", value: part.value });
    } else {
      out.push({ kind: "same", value: part.value });
    }
  }

  return out;
};

const whole = (kind: Piece["kind"], value: string) =>
  [{ kind, value }] satisfies Piece[];

const none: Piece[] = [{ kind: "none", value: "" }];

const isRepealed = (line: DiffLine, side: "a" | "b") =>
  line[side] !== undefined && REPEALED.test(textOf(line, side).trim());

const wordSides = (row: DiffLine) => {
  const all = pieces(row.parts);

  return {
    old: all.filter((piece) => piece.kind !== "ins" && piece.kind !== "modNew"),
    current: all.filter(
      (piece) => piece.kind !== "del" && piece.kind !== "modOld"
    ),
    merged: all,
  };
};

const repealedSides = (row: DiffLine, gap: Piece[]) => {
  const before = row.a ? whole("del", textOf(row, "a")) : gap;
  const current = whole("gone", textOf(row, "b"));

  return {
    old: before,
    current,
    merged: [...(row.a ? [...before, ...whole("same", " ")] : []), ...current],
  };
};

const sidesOf = (row: DiffLine, gap: Piece[]) => {
  if (isRepealed(row, "b") && !isRepealed(row, "a")) {
    return repealedSides(row, gap);
  }

  if (row.kind === "sama") {
    const same = whole("same", textOf(row, "b"));

    return {
      old: whole("same", textOf(row, "a")),
      current: same,
      merged: same,
    };
  }

  if (row.kind === "baru") {
    const added = whole("ins", textOf(row, "b"));

    return { old: gap, current: added, merged: added };
  }

  if (row.kind === "dihapus") {
    const removed = whole("del", textOf(row, "a"));

    return { old: removed, current: gap, merged: removed };
  }

  if (row.kind === "diganti") {
    const old = whole("modOld", textOf(row, "a"));
    const current = whole("modNew", textOf(row, "b"));

    return {
      old,
      current,
      merged: [...old, ...whole("same", " "), ...current],
    };
  }

  return wordSides(row);
};

type PairRow = PairPasal;

type Side = "older" | "newer";

const linesOf = (link: PairRow) => link.numbered ?? link.lines;

const sideLines = (link: PairRow, side: Side) => {
  const bothSides = link.before === "text" && link.after === "text";

  return linesOf(link).map((row) => {
    const place = row.b ?? row.a;
    const sides = sidesOf(row, bothSides ? none : []);

    return {
      kind: row.kind,
      indent: place?.indent ?? 0,
      num: (side === "older" ? row.a : row.b)?.num,
      pieces: side === "older" ? sides.old : sides.current,
    } satisfies CompareLine;
  });
};

const mergedLines = (link: PairRow) =>
  linesOf(link).map((row) => {
    const place = row.b ?? row.a;

    return {
      kind: row.kind,
      indent: place?.indent ?? 0,
      num: place?.num,
      pieces: sidesOf(row, []).merged,
    } satisfies CompareLine;
  });

const plainLines = (link: PairRow, side: Side) =>
  linesOf(link).flatMap((row) => {
    const place = row[side === "older" ? "a" : "b"];

    return place === undefined
      ? []
      : [
          {
            kind: "sama",
            indent: place.indent,
            num: place.num,
            pieces: whole("same", textOf(row, side === "older" ? "a" : "b")),
          } satisfies CompareLine,
        ];
  });

const absence = (state: PasalState, older: boolean) => {
  if (state === "unreadable") {
    return "teks belum terbaca dari PDF";
  }

  if (state === "deleted") {
    return "pasal ini dihapus";
  }

  if (state === "absent") {
    return older ? "pasal ini belum ada" : "pasal ini tidak ada";
  }

  return "";
};

const markOf = (older: PasalState, newer: PasalState) => {
  if (older !== "text" && newer === "text") {
    return "ins" satisfies Mark;
  }

  return newer === "deleted" && older !== "deleted"
    ? ("del" satisfies Mark)
    : ("mod" satisfies Mark);
};

interface Link {
  rows: ReadonlyMap<string, PairRow>;
  olderIsLeft: boolean;
}

const sideOfColumn = (link: Link, column: "left" | "right") =>
  (column === "left") === link.olderIsLeft ? "older" : "newer";

const stateOf = (row: PairRow, side: Side) =>
  side === "older" ? row.before : row.after;

const unmarkedCell = (link: Link, row: PairRow, column: "left" | "right") => {
  const side = sideOfColumn(link, column);
  const state = stateOf(row, side);

  return {
    state,
    lines: state === "text" ? plainLines(row, side) : [],
  } satisfies CompareCell;
};

const changedAt = (links: (Link | undefined)[], num: string, at: number) => {
  const link = links[at];
  const row = link?.rows.get(num);

  return link !== undefined && row !== undefined ? { link, row } : undefined;
};

const cellAt = (links: (Link | undefined)[], num: string, index: number) => {
  const own = changedAt(links, num, index === 0 ? 0 : index - 1);

  if (own !== undefined) {
    const side = sideOfColumn(own.link, index === 0 ? "left" : "right");

    return {
      state: stateOf(own.row, side),
      lines: sideLines(own.row, side),
    } satisfies CompareCell;
  }

  for (let at = Math.min(index, links.length) - 1; at >= 0; at -= 1) {
    const found = changedAt(links, num, at);

    if (found !== undefined) {
      return unmarkedCell(found.link, found.row, "right");
    }
  }

  for (let at = index; at < links.length; at += 1) {
    const found = changedAt(links, num, at);

    if (found !== undefined) {
      return unmarkedCell(found.link, found.row, "left");
    }
  }

  return { state: "absent", lines: [] } satisfies CompareCell;
};

const noteOf = (cells: CompareCell[], cites: string[], newest: number) =>
  cells
    .flatMap((cell, index) => {
      const reason = absence(cell.state, index !== newest);

      return reason === "" ? [] : [`${cites[index]}: ${reason}`];
    })
    .join(" · ");

const rowOf = (
  num: string,
  links: (Link | undefined)[],
  columns: readonly number[],
  versions: CollectionVersions
) => {
  const cells = columns.map((_, index) => cellAt(links, num, index));
  const oldest = columns.indexOf(Math.min(...columns));
  const newest = columns.lastIndexOf(Math.max(...columns));
  const first = links[0]?.rows.get(num);

  const row: CompareRow = {
    num,
    key: pasalKey(num),
    mark: markOf(cells[oldest].state, cells[newest].state),
    note: noteOf(
      cells,
      columns.map((column) => versions[column].cite),
      newest
    ),
    cells,
  };

  if (columns.length === 2 && first !== undefined) {
    row.merged = mergedLines(first);
  }

  return row;
};

const choiceOf = ({ id, label, cite, date }: CollectionVersions[number]) => ({
  id,
  label,
  cite,
  date,
});

/**
 * The pasal that differ between neighbouring columns, each with every column's text. `pairs`
 * holds the published comparison of each neighbouring pair of columns, stored older version
 * first (null when both columns are the same version).
 */
export const compareColumns = (
  versions: CollectionVersions,
  selection: ColumnSelection,
  pairs: (VersionPair | null)[]
) => {
  const { columns } = selection;

  const links = pairs.map((pair, index) =>
    pair === null
      ? undefined
      : ({
          rows: new Map(pair.pasal.map((row) => [row.num, row])),
          olderIsLeft: columns[index] < columns[index + 1],
        } satisfies Link)
  );

  const nums = new Set(links.flatMap((link) => [...(link?.rows.keys() ?? [])]));

  const first = Math.min(...columns);
  const last = Math.max(...columns);

  return {
    versions: versions.map(choiceOf),
    requested: selection.requested,
    unknown: selection.unknown,
    chosen: columns.map((column) => versions[column].id),
    rows: [...nums]
      .toSorted(byNumber)
      .map((num) => rowOf(num, links, columns, versions)),
    gap:
      columns.length === 0
        ? 0
        : versions
            .slice(first + 1, last + 1)
            .reduce((total, version) => total + version.gap, 0),
  } satisfies Comparison;
};

const articleNumbers = (text: ReaderText) => {
  const found: { eId: string; num: string }[] = [];

  const visit = (nodes: ReaderText["body"]) => {
    for (const node of nodes) {
      if (
        node.tag === "article" &&
        isPresent(node.num) &&
        isPresent(node.eId)
      ) {
        found.push({ eId: node.eId, num: node.num });
      }

      visit(node.children);
    }
  };

  visit(text.body);

  return found;
};

const placements = (text: ReaderText, missing: string[]) => {
  const placed = articleNumbers(text);
  const after: Record<string, string[]> = {};

  for (const num of missing) {
    const previous = placed.findLast((entry) => byNumber(entry.num, num) < 0);

    if (previous === undefined) {
      continue;
    }

    after[previous.eId] = [...(after[previous.eId] ?? []), num].toSorted(
      byNumber
    );
    placed.splice(placed.indexOf(previous) + 1, 0, {
      eId: previous.eId,
      num,
    });
  }

  return after;
};

/** A comparison read against a law's own text: the pasal it has, and the pasal it lacks with
 * the pasal each goes after. A pasal that has no place at all is dropped. */
export const placeInText = (comparison: Comparison, text: ReaderText) => {
  const present = new Set(articleNumbers(text).map((entry) => entry.num));

  const after = placements(
    text,
    comparison.rows.flatMap((row) => (present.has(row.num) ? [] : [row.num]))
  );

  const placed = new Set(Object.values(after).flat());

  return {
    ...comparison,
    rows: comparison.rows.filter(
      (row) => present.has(row.num) || placed.has(row.num)
    ),
    after,
  } satisfies LawComparison;
};
