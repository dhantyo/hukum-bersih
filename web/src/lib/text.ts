export const isPresent = (text: string | undefined | null): text is string =>
  text !== undefined && text !== null && text !== "";
