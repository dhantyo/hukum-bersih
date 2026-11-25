import type {
  CollectionVersions,
  PasalState,
  VersionPair,
} from "../server/records/collection-comparison.ts";
import type { DiffLine, DiffPart } from "../server/records/diff-line.ts";

export interface ChangedLine {
  kind: DiffLine["kind"];
  num: string | null;
  indent: number;
  parts: DiffPart[];
}

export interface VersionChoice {
  id: string;
  label: string;
  cite: string;
  date: string | null;
}

/** One pasal in one column: how it stands in that version and, when it has text, its lines.
 * Lines carry the change marks when the column's pasal differs from the column to its left. */
export interface ColumnCell {
  state: PasalState;
  lines: ChangedLine[];
}

export interface ColumnRow {
  num: string;
  cells: ColumnCell[];
}

export interface CollectionCompareView {
  versions: VersionChoice[];
  /** ids of the columns, left to right; empty when no comparison was asked for or it was unknown */
  chosen: string[];
  /** the search named a version the collection does not have */
  unknown: boolean;
  /** the pasal that differ between two neighbouring columns, in number order */
  rows: ColumnRow[];
  /** amendments between the first and last version shown that this collection does not record */
  gap: number;
}

export interface CompareRequest {
  v?: string | string[];
  bandingkan?: string;
  dari?: string;
}

export interface ColumnSelection {
  unknown: boolean;
  /** indexes into the versions, one per column */
  columns: readonly number[];
}

const SEPARATOR = ",";
const MIN_COLUMNS = 2;
const NUMBER = /^(?<digits>\d+)(?<suffix>[A-Za-z]*)$/u;

const none = { unknown: false, columns: [] } satisfies ColumnSelection;
const unknown = { unknown: true, columns: [] } satisfies ColumnSelection;

const namedColumns = (ids: string[], named: string | string[]) => {
  const asked = [named]
    .flat()
    .flatMap((entry) => entry.split(SEPARATOR))
    .filter((id) => id !== "");

  const columns = asked.map((id) => ids.indexOf(id));

  return columns.includes(-1) || columns.length < MIN_COLUMNS
    ? unknown
    : ({ unknown: false, columns } satisfies ColumnSelection);
};

const pairColumns = (
  ids: string[],
  bandingkan: string | undefined,
  dari: string | undefined
) => {
  const to =
    bandingkan === undefined || bandingkan === ""
      ? ids.length - 1
      : ids.indexOf(bandingkan);

  const from = dari === undefined ? to - 1 : ids.indexOf(dari);

  if (to < 0 || (dari !== undefined && from < 0)) {
    return unknown;
  }

  return from < 0 || from === to
    ? none
    : ({ unknown: false, columns: [from, to] } satisfies ColumnSelection);
};

/** Which versions a search asks for, one column each. `v` lists them (a comma list, or the
 * field repeated by a GET form); `bandingkan` and `dari` still ask for a pair. */
export const pickColumns = (ids: string[], request: CompareRequest) => {
  if (request.v !== undefined) {
    return namedColumns(ids, request.v);
  }

  if (request.bandingkan === undefined && request.dari === undefined) {
    return none;
  }

  return pairColumns(ids, request.bandingkan, request.dari);
};

const plainLines = (rows: DiffLine[], side: "a" | "b") =>
  rows.flatMap((row) => {
    const place = row[side];

    if (place === undefined) {
      return [];
    }

    const value = row.parts
      .filter((part) => !(side === "a" ? part.added : part.removed))
      .map((part) => part.value)
      .join("");

    return [
      {
        kind: "sama",
        num: place.num ?? null,
        indent: place.indent,
        parts: [{ value, added: false, removed: false }],
      } satisfies ChangedLine,
    ];
  });

const markedLine = (row: DiffLine) => {
  const place = row.b ?? row.a;

  return {
    kind: row.kind,
    num: place?.num ?? null,
    indent: place?.indent ?? 0,
    parts: row.parts,
  } satisfies ChangedLine;
};

type PairRow = VersionPair["pasal"][number];

const isChanged = (link: PairRow | undefined): link is PairRow =>
  link !== undefined;

const cellAt = (links: (PairRow | undefined)[], column: number) => {
  const link = links[column - 1];

  if (link !== undefined) {
    return {
      state: link.after,
      lines: link.after === "text" ? link.lines.map(markedLine) : [],
    } satisfies ColumnCell;
  }

  const before = links.slice(0, Math.max(column - 1, 0)).findLast(isChanged);

  if (before !== undefined) {
    return {
      state: before.after,
      lines: before.after === "text" ? plainLines(before.lines, "b") : [],
    } satisfies ColumnCell;
  }

  const next = links.slice(column).find(isChanged);

  return {
    state: next?.before ?? "absent",
    lines: next?.before === "text" ? plainLines(next.lines, "a") : [],
  } satisfies ColumnCell;
};

const compareNumbers = (x: string, y: string) => {
  const a = NUMBER.exec(x);
  const b = NUMBER.exec(y);

  return (
    Number(a?.groups?.digits) - Number(b?.groups?.digits) ||
    (a?.groups?.suffix ?? "").localeCompare(b?.groups?.suffix ?? "") ||
    x.localeCompare(y)
  );
};

/** The pasal that differ between any two neighbouring columns, with every column's text. `links`
 * holds the published comparison of each neighbouring pair (null when both columns are the same
 * version). A column marks what changed since the column to its left. */
export const compareColumns = (
  versions: CollectionVersions,
  selection: ColumnSelection,
  links: (VersionPair | null)[]
) => {
  const choices = versions.map(({ id, label, cite, date }) => ({
    id,
    label,
    cite,
    date,
  }));

  const { columns } = selection;
  const byNumber = new Map<string, (PairRow | undefined)[]>();

  for (const [index, link] of links.entries()) {
    for (const row of link?.pasal ?? []) {
      const found =
        byNumber.get(row.num) ??
        Array.from<PairRow | undefined>({ length: links.length });

      found[index] = row;
      byNumber.set(row.num, found);
    }
  }

  const rows = [...byNumber.entries()]
    .toSorted(([x], [y]) => compareNumbers(x, y))
    .map(([num, found]) => ({
      num,
      cells: columns.map((_, column) => cellAt(found, column)),
    }));

  const first = Math.min(...columns);
  const last = Math.max(...columns);

  return {
    versions: choices,
    chosen: columns.map((column) => choices[column].id),
    unknown: selection.unknown,
    rows,
    gap:
      columns.length === 0
        ? 0
        : versions
            .slice(first + 1, last + 1)
            .reduce((total, version) => total + version.gap, 0),
  } satisfies CollectionCompareView;
};
