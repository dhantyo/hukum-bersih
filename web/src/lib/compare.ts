// Compare two versions pasal by pasal. Pasal numbers shift between drafts, so pasal are
// matched by content similarity (order-preserving alignment plus a pass for moved pasal),
// then ayat by ayat, then word by word with Google's diff-match-patch and its semantic
// cleanup, which merges scattered small edits into readable "old phrase -> new phrase" blocks.
import { cleanupSemantic, DIFF_DELETE, DIFF_INSERT, makeDiff } from "@sanity/diff-match-patch";
import type { LawDoc } from "./lawdoc.ts";
import { pasalText, type Pasal, type PasalLine } from "./lawtext.ts";

type LineVectors = Map<PasalLine, Map<string, number>>;

/** TF-IDF vector per line, weighted over all lines of the given pasal. Leading numbers
 * ("(1)", "a.") are ignored. */
function linesVectors(pasal: Pasal[]): LineVectors {
  const lines = pasal.flatMap((p) => p.lines);
  const vectors = tfidf(lines.map((l) => l.text));
  return new Map(lines.map((l, k) => [l, vectors[k]]));
}

export interface Part { value: string; added?: boolean; removed?: boolean }

export type Status = "sama" | "berubah" | "baru" | "dihapus";

export interface LineDiff {
  /** "diganti": the same ayat, reworded so much that it is shown old-left / new-right in full. */
  kind: "sama" | "berubah" | "baru" | "dihapus" | "diganti";
  a?: PasalLine;        // the line in the old version (number, indent, text)
  b?: PasalLine;        // the line in the new version
  /** Word diff of the texts (numbers are kept apart in a.num / b.num). */
  parts: Part[];
  /** For "baru" / "dihapus": the most similar ayat elsewhere in the other version, so splits
   * and merges (one pasal becoming two) stay traceable although rows pair pasal one-to-one. */
  ref?: LineRef;
}

export interface LineRef {
  label: string;        // "Pasal 23 ayat (1)"
  side: "a" | "b";      // which version it is in
  pasal: Pasal;
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
/** A "baru"/"dihapus" line points to the most similar line in the other version (TF-IDF
 * cosine) only if it scores at least REF_THRESHOLD and beats the runner-up by REF_MARGIN, so
 * pointers mark a clear counterpart rather than the least bad of many weak ones. */
export const REF_THRESHOLD = 0.3;
export const REF_MARGIN = 0.07;
/** Below this share of unchanged words, a line is shown as removed + added in full instead of
 * an interleaved word diff, which is unreadable when most of the line was rewritten. */
export const REWRITE_THRESHOLD = 0.5;

function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** Multiset of adjacent word pairs. Word pairs rather than single words, so shared legal
 * boilerplate ("Aset Tindak Pidana", "sebagaimana dimaksud") counts for less than shared
 * wording. */
function bigrams(text: string): Map<string, number> {
  const w = words(text);
  const grams = w.length < 2 ? w : w.slice(1).map((x, k) => `${w[k]} ${x}`);
  const counts = new Map<string, number>();
  for (const g of grams) counts.set(g, (counts.get(g) ?? 0) + 1);
  return counts;
}

function dice(a: Map<string, number>, b: Map<string, number>): number {
  let na = 0, nb = 0, common = 0;
  for (const v of a.values()) na += v;
  for (const [g, v] of b) { nb += v; common += Math.min(v, a.get(g) ?? 0); }
  if (!na && !nb) return 1;
  return (2 * common) / (na + nb);
}

/** Dice coefficient on word pairs: 1 = same text, 0 = nothing in common. */
export function similarity(a: string, b: string): number {
  return dice(bigrams(a), bigrams(b));
}

/** Order-preserving alignment maximising total similarity of matched pairs. */
export function align<T>(a: T[], b: T[], threshold = MATCH_THRESHOLD,
                         simOf: (x: T, y: T) => number = similarity as never) {
  const n = a.length, m = b.length;
  const sim: number[][] = a.map((x) => b.map((y) => simOf(x, y)));
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

const whole = (value: string, added: boolean, removed: boolean): Part[] =>
  [{ value, added, removed }];

/** Word-level diff: each word / space / punctuation run becomes one character (the
 * "lines to chars" technique from diff-match-patch's documentation), diff-match-patch diffs
 * those, semantic cleanup merges fragments, and the characters are decoded back to words. */
export function wordDiff(a: string, b: string): Part[] {
  const tokens: string[] = [];
  const index = new Map<string, number>();
  const encode = (text: string) =>
    (text.match(/\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) ?? []).map((t) => {
      let k = index.get(t);
      if (k === undefined) { k = tokens.length; tokens.push(t); index.set(t, k); }
      return String.fromCharCode(0x4e00 + k);   // BMP block, so no surrogate pairs
    }).join("");
  const diffs = cleanupSemantic(makeDiff(encode(a), encode(b), { checkLines: false }));
  return diffs.map(([op, chars]) => ({
    value: Array.from(chars, (c) => tokens[c.charCodeAt(0) - 0x4e00]).join(""),
    added: op === DIFF_INSERT,
    removed: op === DIFF_DELETE,
  }));
}

/** Share of the longer text that is unchanged. */
function unchangedShare(parts: Part[], a: string, b: string): number {
  const same = parts.filter((p) => !p.added && !p.removed).reduce((n, p) => n + p.value.length, 0);
  return same / Math.max(a.length, b.length, 1);
}

/** Ayat-by-ayat diff: align lines (TF-IDF cosine, so reworded ayat still pair up), then word
 * diff only inside matched lines. */
export function diffLines(a: Pasal, b: Pasal, vec: LineVectors = linesVectors([a, b])): LineDiff[] {
  const simOf = (x: PasalLine, y: PasalLine) => cosine(vec.get(x)!, vec.get(y)!);
  return align(a.lines, b.lines, LINE_THRESHOLD, simOf).flatMap(({ i, j }): LineDiff[] => {
    const la = i === undefined ? undefined : a.lines[i];
    const lb = j === undefined ? undefined : b.lines[j];
    if (la && lb) {
      if (la.text === lb.text) return [{ kind: "sama", a: la, b: lb, parts: whole(lb.text, false, false) }];
      const parts = wordDiff(la.text, lb.text);
      if (unchangedShare(parts, la.text, lb.text) < REWRITE_THRESHOLD) {
        return [{ kind: "diganti", a: la, b: lb,
          parts: [...whole(la.text, false, true), ...whole(lb.text, true, false)] }];
      }
      return [{ kind: "berubah", a: la, b: lb, parts }];
    }
    if (la) return [{ kind: "dihapus", a: la, parts: whole(la.text, false, true) }];
    return [{ kind: "baru", b: lb, parts: whole(lb!.text, true, false) }];
  });
}

function row(a: Pasal, b: Pasal, ta: string, tb: string, sim: number, moved: boolean,
             vec: LineVectors) {
  const same = ta === tb;
  return {
    status: (same ? "sama" : "berubah") as Status, a, b, similarity: sim,
    renumbered: a.label !== b.label, moved,
    lines: diffLines(a, b, vec),
  };
}

export const only = (p: Pasal, kind: "baru" | "dihapus"): LineDiff[] =>
  p.lines.map((l) => ({ kind, ...(kind === "baru" ? { b: l } : { a: l }),
    parts: whole(l.text, kind === "baru", kind === "dihapus") }));

export function compare(docA: LawDoc, docB: LawDoc): Comparison {
  const ta = docA.pasal.map(pasalText);
  const tb = docB.pasal.map(pasalText);
  const pairs = align(ta, tb);
  const vec = linesVectors([...docA.pasal, ...docB.pasal]);

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
      rows.push(row(docA.pasal[i], docB.pasal[j], ta[i], tb[j], sim, false, vec));
    } else if (j !== undefined) {
      if (movedTargets.has(j)) continue; // shown where it came from
      rows.push({ status: "baru", b: docB.pasal[j], similarity: 0, renumbered: false,
        moved: false, lines: only(docB.pasal[j], "baru") });
    } else if (moves.has(i!)) {
      const m = moves.get(i!)!;
      rows.push(row(docA.pasal[i!], docB.pasal[m.j], ta[i!], tb[m.j], m.sim, true, vec));
    } else {
      rows.push({ status: "dihapus", a: docA.pasal[i!], similarity: 0, renumbered: false,
        moved: false, lines: only(docA.pasal[i!], "dihapus") });
    }
  }
  addRefs(rows, docA, docB, vec);
  const counts = { sama: 0, berubah: 0, baru: 0, dihapus: 0, renumbered: 0, moved: 0 };
  for (const r of rows) {
    counts[r.status]++;
    if (r.renumbered) counts.renumbered++;
    if (r.moved) counts.moved++;
  }
  return { rows, counts };
}

/** "Pasal 23 ayat (1)" / "Pasal 2 huruf a" / "Pasal 1 angka 3" from a line's number. */
function lineLabel(p: Pasal, line: PasalLine): string {
  const m = line.num?.match(/^\((\d+)\)$|^([a-z])\.$|^(\d+)\.$/);
  if (!m) return p.label;
  return m[1] ? `${p.label} ayat (${m[1]})` : m[2] ? `${p.label} huruf ${m[2]}` : `${p.label} angka ${m[3]}`;
}

/** TF-IDF vectors (unit length) for a set of texts: words common across the documents
 * ("Aset", "Tindak", "Pidana", "sebagaimana dimaksud") weigh little, distinctive words a lot. */
export function tfidf(texts: string[]): Map<string, number>[] {
  const df = new Map<string, number>();
  const tfs = texts.map((t) => {
    const tf = new Map<string, number>();
    for (const w of words(t)) tf.set(w, (tf.get(w) ?? 0) + 1);
    for (const w of tf.keys()) df.set(w, (df.get(w) ?? 0) + 1);
    return tf;
  });
  const n = texts.length;
  return tfs.map((tf) => {
    const v = new Map<string, number>();
    let norm = 0;
    for (const [w, c] of tf) {
      const x = (1 + Math.log(c)) * Math.log(1 + n / df.get(w)!);
      v.set(w, x);
      norm += x * x;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [w, x] of v) v.set(w, x / norm);
    return v;
  });
}

export function cosine(a: Map<string, number>, b: Map<string, number>): number {
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [w, x] of small) dot += x * (large.get(w) ?? 0);
  return dot;
}

function addRefs(rows: PasalComparison[], docA: LawDoc, docB: LawDoc, vec: LineVectors): void {
  const entries = [
    ...docA.pasal.flatMap((p) => p.lines.map((l) => ({ side: "a" as const, p, l }))),
    ...docB.pasal.flatMap((p) => p.lines.map((l) => ({ side: "b" as const, p, l }))),
  ];
  for (const r of rows) {
    // lines already paired in this row are taken; unpaired ones in the same pasal are fair
    // targets (clauses that swapped places cannot both be paired in order)
    const taken = new Set(r.lines.filter((l) => l.a && l.b).flatMap((l) => [l.a!, l.b!]));
    for (const l of r.lines) {
      if (l.kind !== "baru" && l.kind !== "dihapus") continue;
      const own = l.kind === "baru" ? "b" : "a";
      const other = own === "b" ? "a" : "b";               // look in the other version
      const line = own === "a" ? l.a : l.b;
      if (line === undefined) continue;
      let best = { sim: 0, e: undefined as (typeof entries)[number] | undefined };
      let second = 0;
      entries.forEach((e) => {
        if (e.side !== other || taken.has(e.l)) return;
        const sim = cosine(vec.get(line)!, vec.get(e.l)!);
        if (sim > best.sim) { second = best.sim; best = { sim, e }; } else if (sim > second) second = sim;
      });
      if (best.e && best.sim >= REF_THRESHOLD && best.sim - second >= REF_MARGIN) {
        l.ref = { label: lineLabel(best.e.p, best.e.l), side: other, pasal: best.e.p };
      }
    }
  }
}
