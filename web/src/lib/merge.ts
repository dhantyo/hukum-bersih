// The merged text of a law family at one point in time (decision 0010): the base law's text as
// enacted, with each amending law's pasal changes applied in order, up to that point. Built at
// build time from data/ (the base text and the amending laws' instructions, split by
// pipeline/src/hukum_bersih/amendments.py into generated/akn/amendments/<id>.json); never
// stored. What could not be applied stays visible: unreadable new wordings keep the previous
// text and are marked, and the point's gaps are listed by the page (components/MergedBanner.astro).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AKN_DIR } from "./data.ts";
import type { AknNode, LawDoc } from "./lawdoc.ts";
import { citeId, lawPath, loadRegulationText, pathOf } from "./peraturan.ts";
import { historyOf, type HistoryChange, type HistoryPoint } from "./versions.ts";
import type { Koleksi } from "./koleksi.ts";

interface NewPasalJson { num: string; kind: string; text: string; lines: { num: string | null; text: string; indent: number }[] }
interface AmendmentJson { id: string; amends: string; instructions: { n: number; header: string; pasal: NewPasalJson[] }[] }

export type NoteKind = "diubah" | "disisipkan" | "dihapus" | "unreadable";
export interface MergeNote { kind: NoteKind; label: string; href?: string; by: string }

export interface Merged {
  doc: LawDoc;
  point: HistoryPoint;
  /** per pasal number, oldest first: which amending law changed it and how */
  notes: Map<string, MergeNote[]>;
  /** pasal whose latest change could not be read: the text shown is the one before it */
  unreadable: Set<string>;
}

const cache = new Map<string, AmendmentJson | undefined>();
function amendment(id: string): AmendmentJson | undefined {
  if (!cache.has(id)) {
    const file = join(AKN_DIR, "amendments", `${id}.json`);
    cache.set(id, existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined);
  }
  return cache.get(id);
}

const key = (num: string) => {
  const m = num.match(/^(\d+)(.*)$/);
  return m ? [Number(m[1]), m[2].toUpperCase()] as const : [Number.MAX_SAFE_INTEGER, num] as const;
};
const before = (a: string, b: string) => {
  const [x, xs] = key(a), [y, ys] = key(b);
  return x !== y ? x < y : xs < ys;
};

/** A pasal's new wording (lines with their numbers and depth) as Akoma Ntoso-like nodes. */
export function linesToNodes(lines: NewPasalJson["lines"]): AknNode[] {
  const root: AknNode = { tag: "content", children: [] };
  const stack: { node: AknNode; indent: number }[] = [{ node: root, indent: -1 }];
  for (const l of lines) {
    const p: AknNode = { tag: "p", text: l.text, children: [] };
    if (l.num) {
      while (stack.length > 1 && stack.at(-1)!.indent >= l.indent) stack.pop();
      const tag = l.indent === 0 && l.num.startsWith("(") ? "paragraph" : "point";
      const n: AknNode = { tag, num: l.num, children: l.text ? [p] : [] };
      stack.at(-1)!.node.children.push(n);
      stack.push({ node: n, indent: l.indent });
    } else {
      while (stack.length > 1 && stack.at(-1)!.indent >= l.indent) stack.pop();
      stack.at(-1)!.node.children.push(p);
    }
  }
  return root.children;
}

const clone = (n: AknNode): AknNode => ({ ...n, children: n.children.map(clone) });

/** Every article in a tree with its parent's child list, in reading order. */
function articles(nodes: AknNode[], out: { node: AknNode; siblings: AknNode[] }[] = []) {
  for (const n of nodes) {
    if (n.tag === "article") out.push({ node: n, siblings: nodes });
    else articles(n.children, out);
  }
  return out;
}

/** The merged text of family ``k`` at history point ``pointId`` (a "gabungan" point). */
export function mergedDoc(k: Koleksi, pointId: string): Merged | undefined {
  const h = historyOf(k.base);
  const original = loadRegulationText(k.base);
  const upTo = h?.points.findIndex((p) => p.id === pointId) ?? -1;
  if (!h || !original || upTo < 1) return undefined;
  const base = import.meta.env?.BASE_URL ?? "/";
  const doc: LawDoc = { ...original, body: original.body.map(clone), pasal: [], penjelasanPasal: original.penjelasanPasal };
  const notes = new Map<string, MergeNote[]>();
  const unreadable = new Set<string>();
  const note = (num: string, n: MergeNote) => notes.set(num, [...(notes.get(num) ?? []), n]);
  const lawHref = (id: string) => (pathOf(id) ? `${base}${pathOf(id)}` : undefined);

  const points = new Set(h.points.slice(1, upTo + 1).map((p) => p.id));
  const changes: HistoryChange[] = h.changes.filter((c) => points.has(c.point));
  for (const c of changes) {
    const all = articles(doc.body);
    const found = all.find((a) => a.node.num === c.pasal);
    const wording = c.instruction != null
      ? amendment(c.by)?.instructions.find((i) => i.n === c.instruction)?.pasal.find((p) => p.num === c.pasal)
      : undefined;
    const label = citeId(c.by);
    if (c.type === "dihapus") {
      if (found) found.node.children = [];
      note(c.pasal, { kind: "dihapus", label, href: lawHref(c.by), by: c.by });
      unreadable.delete(c.pasal);
      continue;
    }
    if (c.wording !== "read" || !wording?.lines.length) {
      unreadable.add(c.pasal);
      note(c.pasal, { kind: "unreadable", label, href: lawHref(c.by), by: c.by });
      continue;
    }
    const children = linesToNodes(wording.lines);
    if (found) {
      found.node.children = children;
      unreadable.delete(c.pasal);
      note(c.pasal, { kind: c.type === "disisipkan" ? "disisipkan" : "diubah", label, href: lawHref(c.by), by: c.by });
      continue;
    }
    // a new pasal: after the last pasal that comes before it (27A after 27), in that BAB
    const prev = [...all].reverse().find((a) => a.node.num && before(a.node.num, c.pasal));
    const eId = prev?.node.eId ? prev.node.eId.replace(/art_[^_]+$/, `art_${c.pasal}`) : `art_${c.pasal}`;
    const node: AknNode = { tag: "article", num: c.pasal, eId, children };
    if (prev) prev.siblings.splice(prev.siblings.indexOf(prev.node) + 1, 0, node);
    else doc.body.push(node);
    unreadable.delete(c.pasal);
    note(c.pasal, { kind: "disisipkan", label, href: lawHref(c.by), by: c.by });
  }
  return { doc, point: h.points[upTo], notes, unreadable };
}

/** The original law page, for links from the merged text. */
export const originalHref = (k: Koleksi) => `${import.meta.env.BASE_URL}${lawPath(k.base)}`;
