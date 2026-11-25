import { pasalKey } from "../lib/display.ts";
import { isPresent } from "../lib/text.ts";
import type {
  CollectionVersions,
  PairPasal,
  PasalState,
  VersionPair,
} from "./records/collection-comparison.ts";
import type { DiffLine, DiffPart } from "./records/diff-line.ts";
import type { ReaderText } from "./records/reader-text.ts";

/** How a piece of a changed ayat is shown: kept, inserted, struck, reworded (old or new side),
 * repealed ("gone") or absent from that version ("none"). */
export interface Piece {
  kind: "same" | "ins" | "del" | "gone" | "modOld" | "modNew" | "none";
  value: string;
}

export interface ChangedLine {
  kind: DiffLine["kind"];
  indent: number;
  oldNum?: string;
  newNum?: string;
  num?: string;
  old: Piece[];
  new: Piece[];
  inline: Piece[];
}

export type Mark = "ins" | "del" | "mod";

export interface ChangedPasal {
  num: string;
  key: string;
  mark: Mark;
  note: string;
  lines: ChangedLine[];
}

export interface VersionComparison {
  versions: CollectionVersions;
  /** The versions in the left and right column. Colours follow age, not side. */
  left: number;
  right: number;
  older: number;
  newer: number;
  /** Changed pasal, in the order of the stored data. */
  changed: ChangedPasal[];
  /** Changed pasal the text does not have, by the eId of the pasal they follow. */
  after: Record<string, string[]>;
}

const REPEALED = /^dihapus\.?$/iu;

const number = (num: string) =>
  /^(?<digits>\d+)(?<suffix>.*)$/u.exec(num)?.groups;

const byNumber = (x: string, y: string) => {
  const a = number(x);
  const b = number(y);

  return (
    Number(a?.digits) - Number(b?.digits) ||
    (a?.suffix ?? "").localeCompare(b?.suffix ?? "")
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
    inline: all,
  };
};

const repealedSides = (row: DiffLine, gap: Piece[]) => {
  const before = row.a ? whole("del", textOf(row, "a")) : gap;
  const current = whole("gone", textOf(row, "b"));

  return {
    old: before,
    current,
    inline: [...(row.a ? [...before, ...whole("same", " ")] : []), ...current],
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
      inline: same,
    };
  }

  if (row.kind === "baru") {
    const added = whole("ins", textOf(row, "b"));

    return { old: gap, current: added, inline: added };
  }

  if (row.kind === "dihapus") {
    const removed = whole("del", textOf(row, "a"));

    return { old: removed, current: gap, inline: removed };
  }

  if (row.kind === "diganti") {
    const old = whole("modOld", textOf(row, "a"));
    const current = whole("modNew", textOf(row, "b"));

    return {
      old,
      current,
      inline: [...old, ...whole("same", " "), ...current],
    };
  }

  return wordSides(row);
};

const changedLine = (row: DiffLine, bothSides: boolean) => {
  const line = row.b ?? row.a;
  const { old, current, inline } = sidesOf(row, bothSides ? none : []);

  return {
    kind: row.kind,
    indent: line?.indent ?? 0,
    oldNum: row.a?.num,
    newNum: row.b?.num,
    num: line?.num,
    old,
    new: current,
    inline,
  } satisfies ChangedLine;
};

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

const noteOf = (
  versions: CollectionVersions,
  picked: Picked,
  pasal: PairPasal
) =>
  [
    [versions[picked.older].cite, absence(pasal.before, true)],
    [versions[picked.newer].cite, absence(pasal.after, false)],
  ]
    .flatMap(([cite, reason]) => (reason === "" ? [] : [`${cite}: ${reason}`]))
    .join(" · ");

const versionIndex = (versions: CollectionVersions, id: string) =>
  versions.findIndex((version) => version.id === id);

export interface Picked {
  left: number;
  right: number;
  older: number;
  newer: number;
}

/** `to` and `from` are version ids from the query string. Defaults follow the reader's
 * original text: the original against the latest version, and `to` alone against the version
 * before it. */
export const pickVersions = (
  versions: CollectionVersions,
  to: string,
  from: string | undefined
) => {
  const target = versionIndex(versions, to);
  const source = from === undefined ? -1 : versionIndex(versions, from);
  const left = source >= 0 ? source : Math.max(target - 1, 0);
  const right = target >= 0 ? target : versions.length - 1;

  return {
    left,
    right,
    older: Math.min(left, right),
    newer: Math.max(left, right),
  } satisfies Picked;
};

const changedPasal = (
  versions: CollectionVersions,
  picked: Picked,
  pasal: PairPasal
) =>
  ({
    num: pasal.num,
    key: pasalKey(pasal.num),
    mark: markOf(pasal.before, pasal.after),
    note: noteOf(versions, picked, pasal),
    lines: (pasal.numbered ?? pasal.lines).map((row) =>
      changedLine(row, pasal.before === "text" && pasal.after === "text")
    ),
  }) satisfies ChangedPasal;

/** The pasal that differ between the picked versions, read from their published comparison
 * (`pair` is null when the same version is picked twice), set against the pasal of `text`. */
export const compareVersions = (
  versions: CollectionVersions,
  picked: Picked,
  pair: VersionPair | null,
  text: ReaderText
) => {
  const present = new Set(articleNumbers(text).map((entry) => entry.num));

  const changed = (pair?.pasal ?? []).map((pasal) =>
    changedPasal(versions, picked, pasal)
  );

  const missing = changed.flatMap((entry) =>
    present.has(entry.num) ? [] : [entry.num]
  );

  const after = placements(text, missing);
  const placed = new Set(Object.values(after).flat());

  return {
    versions,
    ...picked,
    changed: changed.filter(
      (entry) => present.has(entry.num) || placed.has(entry.num)
    ),
    after,
  } satisfies VersionComparison;
};
