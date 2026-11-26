import type { AknNode } from "../server/records/reader-text.ts";
import { isPresent } from "./text.ts";

export const CONCLUSIONS_ID = "penutup";
export const EXPLANATION_ID = "penjelasan";

const EXPLANATION_PREFIX = `${EXPLANATION_ID}-`;

/** The DOM id the reader gives a node; Penjelasan nodes carry a prefix so they never clash with the body. */
export const elementId = (node: AknNode, explanation: boolean) => {
  const prefix = explanation ? EXPLANATION_PREFIX : "";

  return isPresent(node.eId) ? `${prefix}${node.eId}` : undefined;
};

/** The short permalink (`pasal-27`) of an article id, when the text defines one. */
export const aliasOf = (
  id: string | undefined,
  anchors: Readonly<Record<string, string>> | undefined
) =>
  isPresent(id) && anchors !== undefined && Object.hasOwn(anchors, id)
    ? anchors[id]
    : undefined;
