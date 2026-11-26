// Display helpers for the "Asli / Modern" reader view of law texts (components/LawText.astro,
// DESIGN.md "Law text"). The stored text never changes: Modern only shows headings in normal
// capitals and Penjelasan labels in the body's style.
import type { AknNode } from "./lawdoc.ts";
import { judul } from "./title.ts";

/** Headings in normal capitals for Modern: "KETENTUAN UMUM" -> "Ketentuan Umum". Text that is
 * not written in capitals is left as it is. */
export function modernHeading(text: string): string {
  return /[a-z]/.test(text) ? text : judul(text);
}

/** Penjelasan labels in the body's style: "Ayat (1)" -> "(1)", "Huruf d" -> "d.",
 * "Angka 3" -> "3."; anything else unchanged. */
export function modernLabel(num: string): string {
  let m;
  if ((m = num.match(/^ayat\s*(\(\s*\d+[a-z]?\s*\))$/i))) return m[1].replace(/\s+/g, "");
  if ((m = num.match(/^huruf\s+([a-z]{1,2})\.?$/i))) return `${m[1]}.`;
  if ((m = num.match(/^angka\s+(\d+[a-z]?)\.?$/i))) return `${m[1]}.`;
  return num;
}

/** Key used in pasal anchors: "27" -> "27", "45A" -> "45a". */
export const pasalKey = (num: string) => num.toLowerCase().replace(/[^0-9a-z]+/g, "");

const CUKUP_JELAS = /^cukup\s+jelas\.?$/i;
const texts = (n: AknNode): string[] => (n.tag === "p" ? [n.text ?? ""] : n.children.flatMap(texts));

/** True when everything a Penjelasan entry says is "Cukup jelas." */
export function cukupJelas(n: AknNode): boolean {
  const t = texts(n).filter((x) => x.trim());
  return t.length > 0 && t.every((x) => CUKUP_JELAS.test(x.trim()));
}

/** First words of a pasal, shown next to its heading while it is folded. */
export function preview(n: AknNode, max = 90): string {
  const t = texts(n).join(" ").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, "")}…` : t;
}
