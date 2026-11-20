// Parser for the Markdown law/draft format written by scraper/src/hukum_bersih/parse.py.
// One ayat or list item per line; headings carry stable anchors.
import { parse as parseYaml } from "yaml";

export type NodeKind =
  | "title" | "line" | "bab" | "bagian" | "paragraf" | "pasal"
  | "penjelasan" | "umum" | "pasal-demi-pasal" | "p-pasal";

export interface DocNode {
  kind: NodeKind;
  label: string;        // "BAB I", "Pasal 5", "(1) …" for lines the full text
  anchor?: string;
  title?: string;       // BAB / Bagian / Paragraf title line
  indent: number;       // list nesting for lines (0 = ayat / top level)
  inPenjelasan: boolean;
}

export interface Pasal {
  label: string;        // "Pasal 5"
  anchor: string;       // "pasal-5"
  bab?: string;         // "BAB II"
  lines: { text: string; indent: number }[];
}

export interface LawDoc {
  meta: Record<string, unknown>;
  nodes: DocNode[];
  pasal: Pasal[];
  penjelasan: Map<string, Pasal>; // keyed by pasal label
}

const HEADING = /^(#{1,4})\s+(.*?)(?:\s+\{#([a-z0-9-]+)\})?\s*$/;

export function parseLawDoc(source: string): LawDoc {
  let meta: Record<string, unknown> = {};
  let body = source;
  const fm = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (fm) {
    meta = (parseYaml(fm[1]) as Record<string, unknown>) ?? {};
    body = source.slice(fm[0].length);
  }

  const nodes: DocNode[] = [];
  const pasal: Pasal[] = [];
  const penjelasan = new Map<string, Pasal>();
  let inPenjelasan = false;
  let bab: string | undefined;
  let current: Pasal | undefined;
  let wantTitle: DocNode | undefined;

  for (const raw of body.split("\n")) {
    if (!raw.trim()) continue;
    const h = raw.match(HEADING);
    if (h) {
      const [, hashes, text, anchor] = h;
      let kind: NodeKind;
      if (hashes === "#") kind = "title";
      else if (/^Penjelasan$/.test(text)) { kind = "penjelasan"; inPenjelasan = true; }
      else if (/^BAB\s/.test(text)) kind = "bab";
      else if (/^Bagian\s/.test(text)) kind = "bagian";
      else if (/^Paragraf\s/.test(text)) kind = "paragraf";
      else if (/^Pasal\s/.test(text)) kind = inPenjelasan ? "p-pasal" : "pasal";
      else if (/^Umum$/.test(text)) kind = "umum";
      else kind = "pasal-demi-pasal";
      const node: DocNode = { kind, label: text, anchor, indent: 0, inPenjelasan };
      nodes.push(node);
      wantTitle = kind === "bab" || kind === "bagian" || kind === "paragraf" ? node : undefined;
      if (kind === "bab") bab = text;
      if (kind === "pasal" || kind === "p-pasal") {
        current = { label: text, anchor: anchor ?? "", bab, lines: [] };
        if (kind === "pasal") pasal.push(current);
        else penjelasan.set(text, current);
      } else {
        current = undefined;
      }
      continue;
    }
    if (wantTitle) {
      wantTitle.title = raw.trim();
      wantTitle = undefined;
      continue;
    }
    const indent = Math.floor((raw.length - raw.trimStart().length) / 2);
    const text = raw.trim();
    nodes.push({ kind: "line", label: text, indent, inPenjelasan });
    current?.lines.push({ text, indent });
  }
  return { meta, nodes, pasal, penjelasan };
}

export function pasalText(p: Pasal): string {
  return p.lines.map((l) => "  ".repeat(l.indent) + l.text).join("\n");
}
