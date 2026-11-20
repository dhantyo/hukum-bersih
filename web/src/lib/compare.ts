// Compare two versions pasal by pasal. Pasal numbers shift between drafts, so pasal are
// matched by content similarity (order-preserving alignment), then diffed word by word.
import { diffWordsWithSpace, type ChangeObject } from "diff";
import { pasalText, type LawDoc, type Pasal } from "./lawdoc.ts";

export type Status = "sama" | "berubah" | "baru" | "dihapus";

export interface LineDiff {
  kind: "sama" | "berubah" | "baru" | "dihapus";
  indent: number;
  parts: ChangeObject<string>[];
}

export interface PasalComparison {
  status: Status;
  a?: Pasal;
  b?: Pasal;
  similarity: number;
  renumbered: boolean;
  moved: boolean;       // matched outside the original order (provision relocated)
  lines: LineDiff[];
}

export interface Comparison {
  rows: PasalComparison[];
  counts: Record<Status, number> & { renumbered: number; moved: number };
}

/** In-order pairs below this similarity are treated as one removed and one added pasal. */
export const MATCH_THRESHOLD = 0.3;
/** Out-of-order (moved) pairs need stronger evidence. */
export const MOVE_THRESHOLD = 0.35;
/** Ayat / list items inside a matched pasal. */
export const LINE_THRESHOLD = 0.3;

function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Dice coefficient on multisets of adjacent word pairs: 1 = same text, 0 = nothing in
 * common. Word pairs rather than single words, so shared legal boilerplate ("Aset Tindak
 * Pidana", "sebagaimana dimaksud") counts for less than shared wording. */
export function similarity(a: string, b: string): number {
  const bigrams = (t: string) => {
    const w = words(t);
    return w.length < 2 ? w : w.slice(1).map((x, k) => `${w[k]} ${x}`);
  };
  const wa = bigrams(a);
  const wb = bigrams(b);
  if (!wa.length && !wb.length) return 1;
  const counts = new Map<string, number>();
  for (const w of wa) counts.set(w, (counts.get(w) ?? 0) + 1);
  let common = 0;
  for (const w of wb) {
    const c = counts.get(w) ?? 0;
    if (c > 0) { common++; counts.set(w, c - 1); }
  }
  return (2 * common) / (wa.length + wb.length);
}

/** Order-preserving alignment maximising total similarity of matched pairs. */
export function align(a: string[], b: string[], threshold = MATCH_THRESHOLD) {
  const n = a.length, m = b.length;
  const sim: number[][] = a.map((x) => b.map((y) => similarity(x, y)));
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const s = sim[i - 1][j - 1];
      score[i][j] = Math.max(
        score[i - 1][j],
        score[i][j - 1],
        s >= threshold ? score[i - 1][j - 1] + s : -Infinity,
      );
    }
  }
  const pairs: { i?: number; j?: number; sim: number }[] = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && sim[i - 1][j - 1] >= threshold &&
        score[i][j] === score[i - 1][j - 1] + sim[i - 1][j - 1]) {
      pairs.push({ i: i - 1, j: j - 1, sim: sim[i - 1][j - 1] }); i--; j--;
    } else if (j > 0 && (i === 0 || score[i][j] === score[i][j - 1])) {
      // Walking backwards, take additions first so that in reading order a removed
      // line is shown before the line that replaced it.
      pairs.push({ j: j - 1, sim: 0 }); j--;
    } else {
      pairs.push({ i: i - 1, sim: 0 }); i--;
    }
  }
  return pairs.reverse();
}

const whole = (value: string, added: boolean, removed: boolean) =>
  [{ value, added, removed, count: 1 }];

/** Ayat-by-ayat diff: align lines, then word diff only inside matched lines. */
export function diffLines(a: Pasal, b: Pasal): LineDiff[] {
  const la = a.lines.map((l) => l.text);
  const lb = b.lines.map((l) => l.text);
  return align(la, lb, LINE_THRESHOLD).map(({ i, j }) => {
    if (i !== undefined && j !== undefined) {
      const same = la[i] === lb[j];
      return {
        kind: same ? "sama" : "berubah", indent: b.lines[j].indent,
        parts: same ? whole(lb[j], false, false) : diffWordsWithSpace(la[i], lb[j]),
      } as LineDiff;
    }
    if (i !== undefined) {
      return { kind: "dihapus", indent: a.lines[i].indent, parts: whole(la[i], false, true) };
    }
    return { kind: "baru", indent: b.lines[j!].indent, parts: whole(lb[j!], true, false) };
  });
}

function row(a: Pasal, b: Pasal, ta: string, tb: string, sim: number, moved: boolean) {
  const same = ta === tb;
  return {
    status: (same ? "sama" : "berubah") as Status, a, b, similarity: sim,
    renumbered: a.label !== b.label, moved,
    lines: diffLines(a, b),
  };
}

const only = (p: Pasal, kind: "baru" | "dihapus"): LineDiff[] =>
  p.lines.map((l) => ({ kind, indent: l.indent,
    parts: whole(l.text, kind === "baru", kind === "dihapus") }));

export function compare(docA: LawDoc, docB: LawDoc): Comparison {
  const ta = docA.pasal.map(pasalText);
  const tb = docB.pasal.map(pasalText);
  const pairs = align(ta, tb);

  // Second pass: pair leftover removed/added pasal that clearly moved elsewhere.
  const lonelyA = pairs.filter((p) => p.j === undefined).map((p) => p.i!);
  const lonelyB = new Set(pairs.filter((p) => p.i === undefined).map((p) => p.j!));
  const moves = new Map<number, { j: number; sim: number }>();
  const candidates = lonelyA.flatMap((i) =>
    [...lonelyB].map((j) => ({ i, j, sim: similarity(ta[i], tb[j]) })))
    .filter((c) => c.sim >= MOVE_THRESHOLD)
    .sort((x, y) => y.sim - x.sim);
  for (const c of candidates) {
    if (moves.has(c.i) || !lonelyB.has(c.j)) continue;
    moves.set(c.i, { j: c.j, sim: c.sim });
    lonelyB.delete(c.j);
  }
  const movedTargets = new Set([...moves.values()].map((m) => m.j));

  const rows: PasalComparison[] = [];
  for (const { i, j, sim } of pairs) {
    if (i !== undefined && j !== undefined) {
      rows.push(row(docA.pasal[i], docB.pasal[j], ta[i], tb[j], sim, false));
    } else if (j !== undefined) {
      if (movedTargets.has(j)) continue; // shown where it came from
      rows.push({ status: "baru", b: docB.pasal[j], similarity: 0, renumbered: false,
        moved: false, lines: only(docB.pasal[j], "baru") });
    } else if (moves.has(i!)) {
      const m = moves.get(i!)!;
      rows.push(row(docA.pasal[i!], docB.pasal[m.j], ta[i!], tb[m.j], m.sim, true));
    } else {
      rows.push({ status: "dihapus", a: docA.pasal[i!], similarity: 0, renumbered: false,
        moved: false, lines: only(docA.pasal[i!], "dihapus") });
    }
  }
  const counts = { sama: 0, berubah: 0, baru: 0, dihapus: 0, renumbered: 0, moved: 0 };
  for (const r of rows) {
    counts[r.status]++;
    if (r.renumbered) counts.renumbered++;
    if (r.moved) counts.moved++;
  }
  return { rows, counts };
}
