import { diffLines } from "../../../web/src/lib/compare.ts";
import type { LineDiff, Part } from "../../../web/src/lib/compare.ts";
import { pasalKey } from "../../../web/src/lib/display.ts";
import type { Pasal } from "../../../web/src/lib/lawtext.ts";
import { isPresent } from "../lib/text.ts";
import type { CollectionComparison } from "./records/collection-comparison.ts";
import type { ReaderText } from "./records/reader-text.ts";

type Slot = CollectionComparison["pasal"][number][1][number][1];

/** How a piece of a changed ayat is shown: kept, inserted, struck, reworded (old or new side),
 * repealed ("gone") or absent from that version ("none"). */
export interface Piece {
  kind: "same" | "ins" | "del" | "gone" | "modOld" | "modNew" | "none";
  value: string;
}

export interface ChangedLine {
  kind: LineDiff["kind"];
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
  versions: CollectionComparison["versions"];
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

const slotAt = (history: [number, Slot][] | undefined, version: number) =>
  history?.findLast(([index]) => index <= version)?.[1];

const toPasal = (num: string, slot: Slot | undefined) =>
  Array.isArray(slot)
    ? ({
        label: `Pasal ${num}`,
        num,
        eId: `cmp-${num}`,
        lines: slot.map(([line, text, indent]) => ({
          num: line ?? undefined,
          text,
          indent,
        })),
      } satisfies Pasal)
    : undefined;

const pieces = (parts: Part[]) => {
  const out: Piece[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const next = parts[index + 1];

    if (part.removed === true && next?.added === true) {
      out.push(
        { kind: "modOld", value: part.value },
        { kind: "modNew", value: next.value }
      );
      index += 1;
    } else if (part.added === true) {
      out.push({ kind: "ins", value: part.value });
    } else if (part.removed === true) {
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

const lineRows = (
  num: string,
  older: Slot | undefined,
  newer: Slot | undefined
) => {
  const before = toPasal(num, older);
  const after = toPasal(num, newer);

  if (before && after) {
    return diffLines(before, after, undefined, { byNumber: true });
  }

  if (after) {
    return after.lines.map(
      (line) =>
        ({
          kind: "baru",
          b: line,
          parts: [{ value: line.text, added: true }],
        }) satisfies LineDiff
    );
  }

  return (before?.lines ?? []).map(
    (line) =>
      ({
        kind: "dihapus",
        a: line,
        parts: [{ value: line.text, removed: true }],
      }) satisfies LineDiff
  );
};

const isRepealed = (line: { text: string } | undefined) =>
  line !== undefined && REPEALED.test(line.text.trim());

const wordSides = (row: LineDiff) => {
  const all = pieces(row.parts);

  return {
    old: all.filter((piece) => piece.kind !== "ins" && piece.kind !== "modNew"),
    current: all.filter(
      (piece) => piece.kind !== "del" && piece.kind !== "modOld"
    ),
    inline: all,
  };
};

const repealedSides = (row: LineDiff, gap: Piece[]) => {
  const before = row.a ? whole("del", row.a.text) : gap;
  const current = whole("gone", row.b?.text ?? "");

  return {
    old: before,
    current,
    inline: [...(row.a ? [...before, ...whole("same", " ")] : []), ...current],
  };
};

const sidesOf = (row: LineDiff, gap: Piece[]) => {
  if (isRepealed(row.b) && !isRepealed(row.a)) {
    return repealedSides(row, gap);
  }

  if (row.kind === "sama") {
    const same = whole("same", row.b?.text ?? "");

    return {
      old: whole("same", row.a?.text ?? ""),
      current: same,
      inline: same,
    };
  }

  if (row.kind === "baru") {
    const added = whole("ins", row.b?.text ?? "");

    return { old: gap, current: added, inline: added };
  }

  if (row.kind === "dihapus") {
    const removed = whole("del", row.a?.text ?? "");

    return { old: removed, current: gap, inline: removed };
  }

  if (row.kind === "diganti") {
    const old = whole("modOld", row.a?.text ?? "");
    const current = whole("modNew", row.b?.text ?? "");

    return {
      old,
      current,
      inline: [...old, ...whole("same", " "), ...current],
    };
  }

  return wordSides(row);
};

const changedLine = (row: LineDiff, bothSides: boolean) => {
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

const absence = (slot: Slot | undefined, older: boolean) => {
  if (slot === "u") {
    return "teks belum terbaca dari PDF";
  }

  if (slot === "d") {
    return "pasal ini dihapus";
  }

  if (slot === null || slot === undefined) {
    return older ? "pasal ini belum ada" : "pasal ini tidak ada";
  }

  return "";
};

const markOf = (older: Slot | undefined, newer: Slot | undefined) => {
  if (!Array.isArray(older) && Array.isArray(newer)) {
    return "ins" satisfies Mark;
  }

  return newer === "d" && older !== "d"
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

    after[previous.eId] = [num, ...(after[previous.eId] ?? [])];
    placed.splice(placed.indexOf(previous) + 1, 0, { eId: `+${num}`, num });
  }

  return after;
};

const noteOf = (
  data: CollectionComparison,
  older: number,
  newer: number,
  before: Slot | undefined,
  after: Slot | undefined
) =>
  [
    [data.versions[older].cite, absence(before, true)],
    [data.versions[newer].cite, absence(after, false)],
  ]
    .flatMap(([cite, reason]) => (reason === "" ? [] : [`${cite}: ${reason}`]))
    .join(" · ");

const versionIndex = (data: CollectionComparison, id: string) =>
  data.versions.findIndex((version) => version.id === id);

/** `to` and `from` are version ids from the query string. Defaults follow the reader's
 * original text: the original against the latest version, and `to` alone against the version
 * before it. */
export const compareVersions = (
  data: CollectionComparison,
  text: ReaderText,
  to: string,
  from: string | undefined
) => {
  const last = data.versions.length - 1;
  const target = versionIndex(data, to);
  const source = from === undefined ? -1 : versionIndex(data, from);
  const left = source >= 0 ? source : Math.max(target - 1, 0);
  const right = target >= 0 ? target : last;
  const older = Math.min(left, right);
  const newer = Math.max(left, right);
  const present = new Set(articleNumbers(text).map((entry) => entry.num));
  const changed: ChangedPasal[] = [];

  for (const [num, history] of data.pasal) {
    if (
      older === newer ||
      !history.some(([index]) => index > older && index <= newer)
    ) {
      continue;
    }

    const before = slotAt(history, older);
    const after = slotAt(history, newer);
    const rows = lineRows(num, before, after);
    const bothSides = Array.isArray(before) && Array.isArray(after);

    changed.push({
      num,
      key: pasalKey(num),
      mark: markOf(before, after),
      note: noteOf(data, older, newer, before, after),
      lines: rows.map((row) => changedLine(row, bothSides)),
    });
  }

  const missing = changed.flatMap((entry) =>
    present.has(entry.num) ? [] : [entry.num]
  );

  const after = placements(text, missing);
  const placed = new Set(Object.values(after).flat());

  return {
    versions: data.versions,
    left,
    right,
    older,
    newer,
    changed: changed.filter(
      (entry) => present.has(entry.num) || placed.has(entry.num)
    ),
    after,
  } satisfies VersionComparison;
};
