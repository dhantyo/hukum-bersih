import * as v from "valibot";

export const parseRecord = <const TSchema extends v.GenericSchema>(
  schema: TSchema,
  text: string,
  label: string
) => {
  const result = v.safeParse(schema, JSON.parse(text));

  if (!result.success) {
    throw new Error(
      `Invalid published ${label}: ${v.summarize(result.issues)}`
    );
  }

  return result.output;
};
