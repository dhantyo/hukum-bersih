import type { Comparison, PasalComparison } from "../../web/src/lib/compare.ts";
import type { Pasal, PasalLine } from "../../web/src/lib/lawtext.ts";

const WEAK_SIMILARITY = 0.34;

const lineSide = (line: PasalLine | undefined) =>
  line && { num: line.num, indent: line.indent };

const anchorOfRow = ({ a, b }: PasalComparison) => {
  const pasal = b ?? a;

  if (pasal === undefined) {
    throw new Error("A comparison row has no pasal on either side");
  }

  return `${b ? "b" : "a"}-${pasal.eId}`;
};

const anchorsByPasal = (rows: PasalComparison[]) => {
  const anchors = new Map<Pasal, string>();

  for (const row of rows) {
    for (const pasal of [row.a, row.b]) {
      if (pasal) {
        anchors.set(pasal, anchorOfRow(row));
      }
    }
  }

  return anchors;
};

const lookup = <Key, Value>(map: Map<Key, Value>, key: Key) => {
  const value = map.get(key);

  if (value === undefined) {
    throw new Error("A cross-reference points at a pasal outside the rows");
  }

  return value;
};

export const draftComparisonRows = ({ rows }: Comparison) => {
  const anchors = anchorsByPasal(rows);
  let chapter: string | undefined;

  return rows.map((row) => {
    const heading = row.b?.chapter;

    const newChapter =
      heading !== undefined && heading !== chapter ? heading : undefined;

    chapter = newChapter ?? chapter;

    return {
      anchor: anchorOfRow(row),
      status: row.status,
      renumbered: row.renumbered,
      moved: row.moved,
      weak:
        row.a !== undefined &&
        row.b !== undefined &&
        row.status === "berubah" &&
        row.similarity < WEAK_SIMILARITY,
      chapter: newChapter,
      a: row.a && { label: row.a.label },
      b: row.b && { label: row.b.label },
      lines: row.lines.map((line) => ({
        kind: line.kind,
        a: lineSide(line.a),
        b: lineSide(line.b),
        parts: line.parts,
        ref: line.ref && {
          label: line.ref.label,
          side: line.ref.side,
          anchor: lookup(anchors, line.ref.pasal),
        },
      })),
    };
  });
};
