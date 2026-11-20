// Akoma Ntoso XML (generated from data/ by `hukum-bersih build-akn`) -> a small tree for
// rendering, plus each Pasal flattened into lines (one per ayat / huruf / angka) for comparing.
import { DOMParser, type Element } from "@xmldom/xmldom";

export interface AknNode {
  tag: string;          // Akoma Ntoso element name: chapter, article, paragraph, point, p, ...
  eId?: string;
  num?: string;
  heading?: string;
  text?: string;        // for <p>
  children: AknNode[];
}

export interface PasalLine { text: string; indent: number; eId?: string }

export interface Pasal {
  label: string;        // "Pasal 5"
  num: string;          // "5"
  eId: string;          // "chp_III__art_5"
  chapter?: string;     // "BAB III"
  lines: PasalLine[];
}

export interface LawDoc {
  title?: string;
  preface: AknNode[];
  preamble: AknNode[];
  body: AknNode[];
  conclusions: AknNode[];
  penjelasan: AknNode[];
  pasal: Pasal[];
  penjelasanPasal: Map<string, Pasal>;   // keyed by Pasal number
}

const CONTAINERS = new Set([
  "chapter", "part", "subpart", "article", "paragraph", "point", "item", "blockList", "intro",
  "content", "wrapUp", "mainBody", "body", "preface", "preamble", "conclusions", "p",
]);

const elements = (el: Element): Element[] =>
  Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1);

function textOf(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

function toNode(el: Element): AknNode {
  const node: AknNode = { tag: el.localName ?? el.tagName, children: [] };
  const eId = el.getAttribute("eId");
  if (eId) node.eId = eId;
  if (node.tag === "p") {
    node.text = textOf(el);
    return node;
  }
  for (const child of elements(el)) {
    const tag = child.localName;
    if (tag === "num") node.num = textOf(child);
    else if (tag === "heading") node.heading = textOf(child);
    else if (CONTAINERS.has(tag)) node.children.push(toNode(child));
  }
  return node;
}

/** Flatten one article: its own text plus each paragraph / point as a line. */
function flatten(article: AknNode): PasalLine[] {
  const lines: PasalLine[] = [];
  const walk = (n: AknNode, indent: number, prefix: string | undefined) => {
    let pending = prefix;
    for (const c of n.children) {
      if (c.tag === "p") {
        lines.push({ text: pending ? `${pending} ${c.text}` : c.text ?? "", indent, eId: c.eId });
        pending = undefined;
      } else if (c.tag === "paragraph" || c.tag === "point" || c.tag === "item") {
        const childIndent = c.tag === "paragraph" ? indent : indent + (n.tag === "article" ? 0 : 1);
        walk(c, childIndent, c.num);
      } else {
        walk(c, indent, pending);   // intro / content / wrapUp keep the pending number
        pending = undefined;
      }
    }
    if (pending) lines.push({ text: pending, indent });
  };
  walk(article, 0, undefined);
  return lines;
}

function collectArticles(nodes: AknNode[], chapter?: string, out: Pasal[] = []): Pasal[] {
  for (const n of nodes) {
    if (n.tag === "article") {
      out.push({ label: `Pasal ${n.num}`, num: n.num ?? "", eId: n.eId ?? "", chapter,
        lines: flatten(n) });
    } else if (n.tag !== "p") {
      collectArticles(n.children, n.tag === "chapter" ? `BAB ${n.num}` : chapter, out);
    }
  }
  return out;
}

export function parseAkn(xml: string): LawDoc {
  const dom = new DOMParser().parseFromString(xml, "text/xml");
  const root = elements(dom.documentElement as unknown as Element)[0]; // <act> / <bill>
  const part = (tag: string) => {
    const el = elements(root).find((e) => e.localName === tag);
    return el ? toNode(el).children : [];
  };
  const attachment = Array.from(root.getElementsByTagName("attachment"))
    .find((a) => elements(a).some((e) => e.localName === "heading" && textOf(e) === "Penjelasan"));
  const mainBody = attachment ? attachment.getElementsByTagName("mainBody")[0] : undefined;
  const penjelasan = mainBody ? toNode(mainBody).children : [];
  const title = Array.from(root.getElementsByTagName("FRBRalias"))
    .find((a) => a.getAttribute("name") === "title")?.getAttribute("value") ?? undefined;
  const body = part("body");
  return {
    title,
    preface: part("preface"),
    preamble: part("preamble"),
    body,
    conclusions: part("conclusions"),
    penjelasan,
    pasal: collectArticles(body),
    penjelasanPasal: new Map(collectArticles(penjelasan).map((p) => [p.num, p])),
  };
}

export function pasalText(p: Pasal): string {
  return p.lines.map((l) => "  ".repeat(l.indent) + l.text).join("\n");
}
