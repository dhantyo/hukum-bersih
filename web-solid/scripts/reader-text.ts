import { articleAliases } from "../../web/src/lib/article-anchors.ts";
import type { LawDoc } from "../../web/src/lib/lawdoc.ts";

export function readerText(document: LawDoc) {
  return {
    preface: document.preface,
    preamble: document.preamble,
    body: document.body,
    conclusions: document.conclusions,
    penjelasan: document.penjelasan,
    anchors: Object.fromEntries(articleAliases(document.body)),
  };
}
