import { pasalKey } from "./display.ts";
import type { AknNode } from "./lawdoc.ts";

export function articleAliases(body: readonly AknNode[]): Map<string, string> {
  const aliases = new Map<string, string>();
  const taken = new Set<string>();
  function visit(node: AknNode) {
    if (node.tag === "article" && node.num && node.eId) {
      const alias = `pasal-${pasalKey(node.num)}`;
      if (!taken.has(alias)) {
        taken.add(alias);
        aliases.set(node.eId, alias);
      }
    }
    node.children.forEach(visit);
  }
  body.forEach(visit);
  return aliases;
}
