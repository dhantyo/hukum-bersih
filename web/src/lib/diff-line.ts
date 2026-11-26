import * as v from "valibot";

const part = v.object({
  value: v.string(),
  added: v.boolean(),
  removed: v.boolean(),
});

const lineSide = v.object({ num: v.optional(v.string()), indent: v.number() });

/** One ayat, huruf or angka of a comparison: how it changed, its place in the older (`a`) and
 * the newer (`b`) text, and the words kept, added and removed. */
export const diffLine = v.object({
  kind: v.picklist(["sama", "berubah", "baru", "dihapus", "diganti"]),
  a: v.optional(lineSide),
  b: v.optional(lineSide),
  parts: v.array(part),
});

export type DiffLine = v.InferOutput<typeof diffLine>;

export type DiffPart = DiffLine["parts"][number];
