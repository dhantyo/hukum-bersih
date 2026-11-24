/** lower case, no punctuation except "/", single spaces */
export const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9/ ]+/g, " ").replace(/\s+/g, " ").trim();
/** "uu 4/2009", "uu no 4 tahun 2009", "4 2009" -> "4/2009" */
export const citeOf = (q: string) => {
  const m = norm(q).match(/^(?:(?:uu|undang undang)\s+)?(?:(?:no|nomor)\s+)?(\w+)\s*(?:\/|\s+tahun\s+|\s+)(\d{4})$/);
  return m ? `${m[1]}/${m[2]}` : undefined;
};
/** "pasal 27 ite", "ite pasal 27", "pasal 5 uu 4/2009" -> { num: "27", rest: "ite" } */
export const pasalOf = (q: string) => {
  const a = norm(q).match(/^(?:pasal|ps)\s+(\d+[a-z]?)\s+(.+)$/);
  if (a) return { num: a[1], rest: a[2] };
  const b = norm(q).match(/^(.+?)\s+(?:pasal|ps)\s+(\d+[a-z]?)$/);
  return b ? { num: b[2], rest: b[1] } : undefined;
};
