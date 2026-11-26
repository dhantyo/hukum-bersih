import type {
  Catalog,
  CatalogCollection,
  LawCatalogEntry,
} from "../server/records/catalog.ts";
import { citeOf, norm, pasalOf } from "./search-query.ts";
import { isPresent } from "./text.ts";

const LAW_LIMIT = 48;
const ARTICLE_LIMIT = 3;
const COLLECTION_LIMIT = 6;

const REPLACED_ROLE = "digantikan";

const STATUS_LABEL = new Map([
  ["berlaku", "Berlaku"],
  ["dicabut", "Dicabut"],
  ["diubah", "Diubah"],
  ["tidak_berlaku", "Tidak berlaku"],
  ["ruu", "RUU"],
]);

const toSearchLaw = (law: LawCatalogEntry) => {
  const short = isPresent(law.s) ? law.s : null;
  const hasTitle = law.t !== "";

  return {
    url: law.u,
    name: short ?? (hasTitle ? law.t : law.c),
    cite: law.c,
    title: short !== null && hasTitle ? law.t : null,
    status: isPresent(law.st)
      ? { key: law.st, label: STATUS_LABEL.get(law.st) ?? law.st }
      : null,
    changed: law.k,
  };
};

const toSearchCollection = (
  group: CatalogCollection,
  byId: Map<string, LawCatalogEntry>
) => ({
  url: group.u,
  name: group.name,
  subject: group.named ? group.t : null,
  count: group.mem.filter(([, role]) => role !== REPLACED_ROLE).length,
  changed: group.k,
  members: group.mem.map(([id, role]) => {
    const law = byId.get(id);

    return {
      role,
      cite: law?.c ?? id,
      title: isPresent(law?.t) ? law.t : null,
      url: law?.u ?? null,
    };
  }),
});

const tokenCache = new Map<string, string[]>();

const tokensOf = (text: string) => {
  const known = tokenCache.get(text);

  if (known !== undefined) {
    return known;
  }

  const tokens = norm(text).split(" ");
  tokenCache.set(text, tokens);

  return tokens;
};

const matchesWords = (query: string) => {
  const words = norm(query)
    .split(" ")
    .filter((word) => word !== "" && word !== "uu");

  return (text: string) => {
    const candidates = tokensOf(text);

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

  return laws.slice(0, ARTICLE_LIMIT).map((law) => ({
    label: `Pasal ${article.num.toUpperCase()} ${law.s ?? law.c}`,
    url: `${law.u}#pasal-${article.num}`,
    law: toSearchLaw(law),
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
    .slice(0, COLLECTION_LIMIT)
    .map(({ group }) => group);

export type SearchLaw = ReturnType<typeof toSearchLaw>;

export type SearchCollection = ReturnType<typeof toSearchCollection>;

export type SearchArticle = ReturnType<typeof articleMatches>[number];

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

  const byId = new Map(catalog.laws.map((law) => [law.id, law]));

  return {
    articles: articleMatches(query, catalog),
    collections: collections.map((group) => toSearchCollection(group, byId)),
    laws: laws.slice(0, LAW_LIMIT).map(toSearchLaw),
  };
};
