import * as v from "valibot";

/** One element of a law text in the shape the reader shows: `tag` is the Akoma Ntoso element
 * (chapter, article, paragraph, point, p, ...). */
export interface AknNode {
  tag: string;
  eId?: string;
  num?: string;
  heading?: string;
  /** for a `p` */
  text?: string;
  children: AknNode[];
}

const optionalText = v.optional(v.string());

const node: v.GenericSchema<AknNode> = v.object({
  tag: v.string(),
  eId: optionalText,
  num: optionalText,
  heading: optionalText,
  text: optionalText,
  children: v.array(v.lazy(() => node)),
});

const nodes = v.array(node);

const text = v.object({
  preface: nodes,
  preamble: nodes,
  body: nodes,
  conclusions: nodes,
  penjelasan: nodes,
  anchors: v.record(
    v.string(),
    v.pipe(v.string(), v.regex(/^pasal-[a-z0-9]+$/u))
  ),
});

export type ReaderText = v.InferOutput<typeof text>;

export const readerText = v.custom<ReaderText>(
  (input) => v.is(text, input),
  "Invalid reader text"
);
