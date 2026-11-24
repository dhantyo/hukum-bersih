import { citeOf, norm, pasalOf } from "../../../web/src/lib/search-query.ts";
import type { LawCatalogEntry, SearchCatalog } from "../server/catalog";

function matchesWords(query: string) {
  const words = norm(query)
    .split(" ")
    .filter((word) => word && word !== "uu");

  return (text: string) => {
    const candidates = norm(text).split(" ");

    return (
      words.length > 0 &&
      words.every((word) => candidates.some((token) => token.startsWith(word)))
    );
  };
}

function hasCitation(law: LawCatalogEntry, citation: string) {
  return law.c.toLowerCase().endsWith(` ${citation}`);
}

function articleMatches(query: string, catalog: SearchCatalog) {
  const article = pasalOf(query);

  if (!article) {
    return [];
  }

  const cite = citeOf(article.rest);
  const match = matchesWords(article.rest);

  const bases = new Set(
    catalog.koleksi
      .filter((group) => group.named && [group.name, ...group.a].some(match))
      .flatMap((group) =>
        group.mem.filter(([, role]) => role === "pokok").map(([id]) => id)
      )
  );

  const laws = catalog.laws.filter(
    (law) =>
      law.c !== "RUU" &&
      (cite
        ? hasCitation(law, cite)
        : bases.has(law.id) || Boolean(law.s && !law.m.length && match(law.s)))
  );

  return laws.slice(0, 3).map((law) => ({
    label: `Pasal ${article.num.toUpperCase()} ${law.s ?? law.c}`,
    url: `${law.u}#pasal-${article.num}`,
  }));
}

export function searchMatches(query: string, catalog: SearchCatalog) {
  const cite = citeOf(query);
  const matches = matchesWords(query);

  const collections = cite
    ? []
    : catalog.koleksi
        .map((group) => ({
          group,
          score:
            group.named && [group.name, ...group.a].some(matches)
              ? 2
              : Number(matches(group.t)),
        }))
        .filter(({ score }) => score > 0)
        .sort(
          (left, right) =>
            right.score - left.score ||
            Number(right.group.named) - Number(left.group.named)
        )
        .slice(0, 6)
        .map(({ group }) => group);

  const shown = new Set(
    collections.flatMap((group) => group.mem.map(([id]) => id))
  );

  const laws = catalog.laws.filter(
    (law) =>
      !shown.has(law.id) &&
      (cite
        ? hasCitation(law, cite)
        : matches(
            `${law.c} ${law.t} ${law.s ?? ""} nomor ${law.n} tahun ${law.y}`
          ))
  );

  laws.sort(
    (left, right) =>
      Number(matches(right.s ?? "")) - Number(matches(left.s ?? "")) ||
      right.y - left.y
  );

  return {
    articles: articleMatches(query, catalog),
    collections,
    laws: laws.slice(0, 8),
  };
}
