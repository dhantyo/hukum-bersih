import { citeOf, norm, pasalOf } from "../../../web/src/lib/search-query.ts";
import type { Catalog, LawCatalogEntry } from "../server/records/catalog.ts";
import { isPresent } from "./text.ts";

const matchesWords = (query: string) => {
  const words = norm(query)
    .split(" ")
    .filter((word) => word !== "" && word !== "uu");

  return (text: string) => {
    const candidates = norm(text).split(" ");

    return (
      words.length > 0 &&
      words.every((word) => candidates.some((token) => token.startsWith(word)))
    );
  };
};

const hasCitation = (law: LawCatalogEntry, citation: string) =>
  law.c.toLowerCase().endsWith(` ${citation}`);

const articleMatches = (query: string, catalog: Catalog) => {
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

  const matchesLaw = (law: LawCatalogEntry) => {
    if (isPresent(cite)) {
      return hasCitation(law, cite);
    }

    return (
      bases.has(law.id) ||
      (isPresent(law.s) && law.m.length === 0 && match(law.s))
    );
  };

  const laws = catalog.laws.filter((law) => law.c !== "RUU" && matchesLaw(law));

  return laws.slice(0, 3).map((law) => ({
    label: `Pasal ${article.num.toUpperCase()} ${law.s ?? law.c}`,
    url: `${law.u}#pasal-${article.num}`,
  }));
};

const matchingCollections = (
  catalog: Catalog,
  matches: (text: string) => boolean
) =>
  catalog.koleksi
    .map((group) => ({
      group,
      score:
        group.named && [group.name, ...group.a].some(matches)
          ? 2
          : Number(matches(group.t)),
    }))
    .filter(({ score }) => score > 0)
    .toSorted(
      (left, right) =>
        right.score - left.score ||
        Number(right.group.named) - Number(left.group.named)
    )
    .slice(0, 6)
    .map(({ group }) => group);

export const searchMatches = (query: string, catalog: Catalog) => {
  const cite = citeOf(query);
  const matches = matchesWords(query);

  const collections = isPresent(cite)
    ? []
    : matchingCollections(catalog, matches);

  const shown = new Set(
    collections.flatMap((group) => group.mem.map(([id]) => id))
  );

  const laws = catalog.laws
    .filter(
      (law) =>
        !shown.has(law.id) &&
        (isPresent(cite)
          ? hasCitation(law, cite)
          : matches(
              `${law.c} ${law.t} ${law.s ?? ""} nomor ${law.n} tahun ${law.y}`
            ))
    )
    .toSorted(
      (left, right) =>
        Number(matches(right.s ?? "")) - Number(matches(left.s ?? "")) ||
        right.y - left.y
    );

  return {
    articles: articleMatches(query, catalog),
    collections,
    laws: laws.slice(0, 8),
  };
};
