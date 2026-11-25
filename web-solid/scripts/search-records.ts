import { cukupJelas } from "../../web/src/lib/display.ts";
import type { AknNode } from "../../web/src/lib/lawdoc.ts";
import {
  aliasOf,
  CONCLUSIONS_ID,
  elementId,
  EXPLANATION_ID,
} from "../src/lib/anchors.ts";
import { isPresent } from "../src/lib/text.ts";
import type { ReaderText } from "../src/server/records/reader-text.ts";

/** A full-text search record: one piece of a page that a result can open directly. */
export interface SearchRecord {
  url: string;
  content: string;
  language: "id";
  meta: { title: string; label: string };
}

const EXPLANATION_TITLE = /^penjelasan$/iu;
const SEARCHABLE = /[\p{L}\p{N}]/u;

const wordsOf: (node: AknNode) => string[] = (node) =>
  node.tag === "p"
    ? [node.text ?? ""]
    : [node.num, node.heading, ...node.children.flatMap(wordsOf)].filter(
        isPresent
      );

const joinWords = (nodes: readonly AknNode[]) =>
  nodes.flatMap(wordsOf).join(" ").replaceAll(/\s+/gu, " ").trim();

const hasArticle: (node: AknNode) => boolean = (node) =>
  node.tag === "article" || node.children.some(hasArticle);

const articlesOf: (nodes: readonly AknNode[]) => AknNode[] = (nodes) =>
  nodes.flatMap((node) =>
    node.tag === "article" ? [node] : articlesOf(node.children)
  );

const explanationNodes: (nodes: readonly AknNode[]) => AknNode[] = (nodes) =>
  nodes.flatMap((node) => {
    if (node.tag === "article") {
      return cukupJelas(node) ? [] : [node];
    }

    return hasArticle(node) ? explanationNodes(node.children) : [node];
  });

const articleLabel = (node: AknNode) => `Pasal ${node.num ?? ""}`.trim();

const blockLabel = (node: AknNode) => {
  const name = [node.num, node.heading].filter(isPresent).join(" ");

  return isPresent(name) && !EXPLANATION_TITLE.test(name)
    ? `Penjelasan ${name}`
    : "Penjelasan";
};

/**
 * The records of one page's reader text: the opening, each article, the closing, and each
 * Penjelasan entry or block that says more than "Cukup jelas". Each URL is the anchor the
 * reader renders for that piece (`elementId`, or the short `pasal-N` alias of an article), so a
 * result opens the exact article. `title` is the page heading.
 */
export const textRecords = (page: string, title: string, text: ReaderText) => {
  const record = (anchor: string | undefined, label: string, content: string) =>
    SEARCHABLE.test(content)
      ? [
          {
            url: isPresent(anchor) ? `${page}#${anchor}` : page,
            content,
            language: "id",
            meta: { title, label },
          } satisfies SearchRecord,
        ]
      : [];

  const articles = articlesOf(text.body).flatMap((node) => {
    const id = elementId(node, false);

    return record(
      aliasOf(id, text.anchors) ?? id,
      articleLabel(node),
      `${articleLabel(node)}. ${joinWords(node.children)}`
    );
  });

  const explanations = explanationNodes(text.penjelasan).flatMap((node) => {
    const anchor = elementId(node, true) ?? EXPLANATION_ID;

    return node.tag === "article"
      ? record(
          anchor,
          `${articleLabel(node)} Penjelasan`,
          `${articleLabel(node)}. ${joinWords(node.children)}`
        )
      : record(anchor, blockLabel(node), joinWords([node]));
  });

  return [
    ...record(
      undefined,
      "Pembukaan",
      joinWords([...text.preface, ...text.preamble])
    ),
    ...articles,
    ...record(
      CONCLUSIONS_ID,
      "Pengesahan dan pengundangan",
      joinWords(text.conclusions)
    ),
    ...explanations,
  ];
};
