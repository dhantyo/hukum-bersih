const ACCENTS = /[\u0300-\u036F]/gu;
const NOT_WORD = /[^a-z0-9/ ]+/gu;
const SPACES = /\s+/gu;

const CITE =
  /^(?:(?:uu|undang undang)\s+)?(?:(?:no|nomor)\s+)?(?<number>\w+)\s*(?:\/|\s+tahun\s+|\s+)(?<year>\d{4})$/u;

const PASAL_FIRST = /^(?:pasal|ps)\s+(?<num>\d+[a-z]?)\s+(?<rest>.+)$/u;
const PASAL_LAST = /^(?<rest>.+?)\s+(?:pasal|ps)\s+(?<num>\d+[a-z]?)$/u;

/** lower case, no punctuation except "/", single spaces */
export const norm = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(ACCENTS, "")
    .replaceAll(NOT_WORD, " ")
    .replaceAll(SPACES, " ")
    .trim();

/** "uu 4/2009", "uu no 4 tahun 2009", "4 2009" -> "4/2009" */
export const citeOf = (query: string) => {
  const found = CITE.exec(norm(query))?.groups;

  return found === undefined ? undefined : `${found.number}/${found.year}`;
};

/** "pasal 27 ite", "ite pasal 27", "pasal 5 uu 4/2009" -> { num: "27", rest: "ite" } */
export const pasalOf = (query: string) => {
  const found =
    PASAL_FIRST.exec(norm(query))?.groups ??
    PASAL_LAST.exec(norm(query))?.groups;

  return found === undefined ? undefined : { num: found.num, rest: found.rest };
};
