import { amendments, data, labels, peraturan } from "./astro-data.ts";

type Regulation = ReturnType<typeof peraturan.loadRegulations>[number];

type Draft = ReturnType<typeof data.loadRuus>[number];

const RECENT_LAWS = 20;

const hasText = (law: Regulation) =>
  law.versions.some((version) => Boolean(version.text));

const lawRow = (law: Regulation) => {
  const relations = peraturan.rel(law);

  return {
    u: `/${peraturan.lawPath(law)}`,
    title: law.subject || law.title,
    short: amendments.shortName(law) ?? null,
    cite: peraturan.shortCite(law),
    status:
      law.status === null
        ? null
        : {
            key: law.status,
            label: peraturan.STATUS_LABEL[law.status] ?? law.status,
          },
    date:
      law.tanggal_penetapan === null
        ? null
        : labels.tanggal(law.tanggal_penetapan),
    changed:
      relations.amended_by.length > 0 ? peraturan.amendmentCount(law) : 0,
    amends: relations.amends.map((target) => peraturan.citeId(target.id)),
    hasText: hasText(law),
  };
};

const sourceOf = (law: Regulation) => peraturan.sourceHost(law.source_url);

const sourcesOf = (laws: Regulation[]) => {
  const hosts = laws.flatMap((law) => sourceOf(law) ?? []);
  const counts = Map.groupBy(hosts, (host) => host);

  return [...counts]
    .toSorted(([, a], [, b]) => b.length - a.length)
    .map(([host]) => ({
      host,
      name: peraturan.SOURCES[host]?.name ?? host,
    }));
};

const decadesOf = (laws: Regulation[]) => {
  const years = [...Map.groupBy(laws, (law) => law.year)].toSorted(
    ([a], [b]) => b - a
  );

  const decades = Map.groupBy(years, ([year]) => Math.floor(year / 10) * 10);

  return [...decades].map(([decade, members]) => ({
    decade,
    years: members.map(([year, items]) => ({ year, count: items.length })),
  }));
};

export const overviewListing = (laws: Regulation[]) => ({
  total: laws.length,
  withText: laws.filter(hasText).length,
  sources: sourcesOf(laws),
  decades: decadesOf(laws),
  recent: laws.slice(0, RECENT_LAWS).map(lawRow),
});

export const yearListings = (laws: Regulation[]) =>
  [...Map.groupBy(laws, (law) => law.year)].map(([year, items]) => ({
    year,
    rows: items.map(lawRow),
  }));

export const draftListing = (draft: Draft) => {
  const last = draft.stages.at(-1);
  const texts = data.versions(draft);
  const first = texts.at(0);
  const latest = texts.at(-1);

  return {
    slug: draft.slug,
    name: draft.short_name ?? draft.title,
    title: draft.title,
    versions: texts.length,
    last:
      last === undefined
        ? null
        : {
            stage: last.stage,
            note: last.note ?? null,
            date: labels.tanggal(last.date),
          },
    changes:
      texts.length > 1 && first !== undefined && latest !== undefined
        ? { from: first.id, to: latest.id }
        : null,
  };
};
