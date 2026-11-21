// A pasal as lines (one per ayat / huruf / angka): the shape compared and rendered. Kept apart
// from lawdoc.ts (XML parsing) so it can be used in the browser too.
/** One ayat / huruf / angka / sentence. ``num`` is its own label ("(1)", "a.") kept apart from
 * the text so it can hang to the left; ``indent`` is how many numbered levels (ayat, huruf,
 * angka) enclose the line, so nested lines line up under their parent's text. */
export interface PasalLine { num?: string; text: string; indent: number; eId?: string }

export interface Pasal {
  label: string;        // "Pasal 5"
  num: string;          // "5"
  eId: string;          // "chp_III__art_5"
  chapter?: string;     // "BAB III"
  lines: PasalLine[];
}


export const lineText = (l: PasalLine): string => (l.num ? `${l.num} ${l.text}` : l.text);

export function pasalText(p: Pasal): string {
  return p.lines.map((l) => "  ".repeat(l.indent) + lineText(l)).join("\n");
}
