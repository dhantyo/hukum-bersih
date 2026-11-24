import { diffLines } from "../../../web/src/lib/compare.ts";
import type { Part } from "../../../web/src/lib/compare.ts";
import type { Pasal } from "../../../web/src/lib/lawtext.ts";
import type {
  CollectionComparison,
  CompareSlot,
} from "../server/records/collection-comparison.ts";

export interface ChangedLine {
  kind: "sama" | "berubah" | "baru" | "dihapus" | "diganti";
  num: string | null;
  indent: number;
  parts: Part[];
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

type Lines = Exclude<CompareSlot, "d" | "u" | null>;

const slotAt = (changes: [number, CompareSlot][], version: number) =>
  changes.findLast(([from]) => from <= version)?.[1] ?? null;

const toPasal = (num: string, slot: Lines) =>
  ({
    label: `Pasal ${num}`,
    num,
    eId: num,
    lines: slot.map(([lineNum, text, indent]) => ({
      num: lineNum ?? undefined,
      text,
      indent,
    })),
  }) satisfies Pasal;

const plain = (slot: Lines, kind: "baru" | "dihapus") =>
  slot.map(([num, text, indent]) => ({
    kind,
    num,
    indent,
    parts: [
      { value: text, added: kind === "baru", removed: kind === "dihapus" },
    ],
  }));

const diffed = (num: string, before: Lines, after: Lines) =>
  diffLines(toPasal(num, before), toPasal(num, after)).map((line) => {
    const side = line.b ?? line.a;

    return {
      kind: line.kind,
      num: side?.num ?? null,
      indent: side?.indent ?? 0,
      parts: line.parts,
    };
  });

const isLines = (slot: CompareSlot): slot is Lines => Array.isArray(slot);

const pasalRow = (
  num: string,
  previousUnreadable: boolean,
  status: ChangedStatus,
  lines: ChangedLine[]
) => ({ num, previousUnreadable, status, lines }) satisfies ChangedPasal;

const changedPasal = (num: string, before: CompareSlot, after: CompareSlot) => {
  if (JSON.stringify(before) === JSON.stringify(after)) {
    return [];
  }

  const unreadable = before === "u";

  if (after === "u") {
    return [pasalRow(num, unreadable, "belum-terbaca", [])];
  }

  if (after === "d" || after === null) {
    const lines = isLines(before) ? plain(before, "dihapus") : [];

    return [
      pasalRow(num, unreadable, after === "d" ? "dihapus" : "belum-ada", lines),
    ];
  }

  return isLines(before)
    ? [pasalRow(num, unreadable, "berubah", diffed(num, before, after))]
    : [pasalRow(num, unreadable, "baru", plain(after, "baru"))];
};

const pickPair = (
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

/** The pasal that differ between two versions, read from the compact per-pasal history. */
export const compareVersions = (
  data: CollectionComparison,
  bandingkan?: string,
  dari?: string
) => {
  const versions = data.versions.map(({ id, label, date }) => ({
    id,
    label,
    date,
  }));

  const { unknown, pair } = pickPair(
    versions.map((version) => version.id),
    bandingkan,
    dari
  );

  if (pair === undefined) {
    return {
      versions,
      selected: null,
      unknown,
      changed: [],
      gap: 0,
    } satisfies CollectionCompareView;
  }

  const [from, to] = pair;

  const changed = data.pasal.flatMap(([num, changes]) =>
    changedPasal(num, slotAt(changes, from), slotAt(changes, to))
  );

  const gap = data.versions
    .slice(Math.min(from, to) + 1, Math.max(from, to) + 1)
    .reduce((total, version) => total + version.gap, 0);

  return {
    versions,
    selected: { from: versions[from].id, to: versions[to].id },
    unknown,
    changed,
    gap,
  } satisfies CollectionCompareView;
};
