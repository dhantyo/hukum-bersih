import * as v from "valibot";

const change = v.object({
  anchor: v.string(),
  num: v.string(),
  kind: v.picklist(["diubah", "disisipkan", "dihapus"]),
  missingBefore: v.boolean(),
  missingAfter: v.boolean(),
  before: v.nullable(v.string()),
  after: v.nullable(v.string()),
});

const amendment = v.object({
  id: v.string(),
  label: v.string(),
  href: v.optional(
    v.pipe(v.string(), v.regex(/^\/[a-z-]+\/[a-z0-9]+\/\d{4}\/$/i))
  ),
  date: v.nullable(v.string()),
  gap: v.pipe(v.number(), v.integer(), v.minValue(0)),
  instructions: v.array(v.string()),
  changes: v.array(change),
});

const comparisonRecord = v.object({
  path: v.string(),
  title: v.string(),
  shortName: v.optional(v.string()),
  amendments: v.array(amendment),
});

export type ComparisonRecord = v.InferOutput<typeof comparisonRecord>;

export function parseComparisonRecord(input: unknown, expectedPath: string) {
  const comparison = v.parse(comparisonRecord, input);

  if (comparison.path !== expectedPath) {
    throw new Error(`Published comparison does not match ${expectedPath}`);
  }

  return comparison;
}
