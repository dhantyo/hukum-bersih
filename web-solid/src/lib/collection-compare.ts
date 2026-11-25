import type {
  CollectionVersions,
  PairPasal,
  VersionPair,
} from "../server/records/collection-comparison.ts";
import type { DiffLine, DiffPart } from "../server/records/diff-line.ts";

export interface ChangedLine {
  kind: DiffLine["kind"];
  num: string | null;
  indent: number;
  parts: DiffPart[];
}

/** How one pasal reads in the second version compared with the first. */
export type ChangedStatus =
  | "berubah"
  | "baru"
  | "dihapus"
  | "belum-ada"
  | "belum-terbaca";

export interface ChangedPasal {
  num: string;
  status: ChangedStatus;
  /** the first version's text was not readable, so only the second is shown */
  previousUnreadable: boolean;
  lines: ChangedLine[];
}

export interface VersionChoice {
  id: string;
  label: string;
  cite: string;
  date: string | null;
}

export interface CollectionCompareView {
  versions: VersionChoice[];
  /** ids of the compared pair, in the order chosen (first = older column) */
  selected: { from: string; to: string } | null;
  /** the search named a version the collection does not have */
  unknown: boolean;
  changed: ChangedPasal[];
  /** amendments between the two versions that this collection does not record */
  gap: number;
}

const lineOf = (row: DiffLine) => {
  const side = row.b ?? row.a;

  return {
    kind: row.kind,
    num: side?.num ?? null,
    indent: side?.indent ?? 0,
    parts: row.parts,
  } satisfies ChangedLine;
};

const afterStatus = {
  unreadable: "belum-terbaca",
  deleted: "dihapus",
  absent: "belum-ada",
} as const;

const statusOf = (pasal: PairPasal) => {
  if (pasal.after !== "text") {
    return afterStatus[pasal.after];
  }

  return pasal.before === "text"
    ? ("berubah" satisfies ChangedStatus)
    : ("baru" satisfies ChangedStatus);
};

const changedPasal = (pasal: PairPasal) =>
  ({
    num: pasal.num,
    previousUnreadable: pasal.before === "unreadable",
    status: statusOf(pasal),
    lines: pasal.after === "unreadable" ? [] : pasal.lines.map(lineOf),
  }) satisfies ChangedPasal;

export interface PairSelection {
  unknown: boolean;
  /** indexes into the versions: from, to */
  pair: readonly [number, number] | undefined;
}

/** Which two versions a search asks for. `bandingkan` alone is compared with the version before
 * it, `dari` alone with the latest, and an empty `bandingkan` means the latest. */
export const pickPair = (
  ids: string[],
  bandingkan: string | undefined,
  dari: string | undefined
) => {
  const none = { unknown: false, pair: undefined };

  if (bandingkan === undefined && dari === undefined) {
    return none;
  }

  const to =
    bandingkan === undefined || bandingkan === ""
      ? ids.length - 1
      : ids.indexOf(bandingkan);

  const from = dari === undefined ? to - 1 : ids.indexOf(dari);

  if (to < 0 || (dari !== undefined && from < 0)) {
    return { unknown: true, pair: undefined };
  }

  return from < 0 || from === to
    ? none
    : { unknown: false, pair: [from, to] as const };
};

/** The pasal that differ between the two selected versions, read from their published
 * comparison (`record` is null when no pair is selected). */
export const compareVersions = (
  versions: CollectionVersions,
  selection: PairSelection,
  record: VersionPair | null
) => {
  const choices = versions.map(({ id, label, cite, date }) => ({
    id,
    label,
    cite,
    date,
  }));

  const { unknown, pair } = selection;

  if (pair === undefined) {
    return {
      versions: choices,
      selected: null,
      unknown,
      changed: [],
      gap: 0,
    } satisfies CollectionCompareView;
  }

  const [from, to] = pair;

  const gap = versions
    .slice(Math.min(from, to) + 1, Math.max(from, to) + 1)
    .reduce((total, version) => total + version.gap, 0);

  return {
    versions: choices,
    selected: { from: choices[from].id, to: choices[to].id },
    unknown,
    changed: (record?.pasal ?? []).map(changedPasal),
    gap,
  } satisfies CollectionCompareView;
};
