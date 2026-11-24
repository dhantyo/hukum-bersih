import { glob, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { data, peraturan, searchCatalog } from "./astro-data.ts";
import { draftListing, overviewListing, yearListings } from "./law-listings.ts";

const writeJson = async (file: string, json: string) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${json}\n`);
};

export const exportCatalog = async (destination: string) => {
  const files = await Array.fromAsync(
    glob("uu/*/*/index.json", { cwd: path.join(destination, "laws") })
  );

  if (files.length === 0) {
    throw new Error("The release contains no exported law documents");
  }

  const paths = new Set(
    files.map((file) => `/${file.slice(0, -"index.json".length)}`)
  );

  const drafts = await Array.fromAsync(
    glob("*/index.json", { cwd: path.join(destination, "drafts") })
  );

  for (const file of drafts) {
    paths.add(`/ruu/${file.slice(0, -"index.json".length)}`);
  }

  const catalog = searchCatalog.searchCatalog("/");

  const complete = catalog.laws
    .filter((law) => law.u.startsWith("/uu/"))
    .every((law) => paths.has(law.u));

  const published = {
    laws: catalog.laws.filter(
      (law) => paths.has(law.u) || (complete && law.c !== "RUU")
    ),
    koleksi: complete ? catalog.koleksi : [],
  };

  await writeFile(
    path.join(destination, "law-catalog.json"),
    `${JSON.stringify(published)}\n`
  );

  const listings = path.join(destination, "listings");

  const listedLaws = peraturan
    .loadRegulations()
    .filter(
      (law) =>
        law.type === "uu" &&
        (complete || paths.has(`/${peraturan.lawPath(law)}`))
    );

  const lists = [
    ["overview.json", overviewListing(listedLaws)],
    ...yearListings(listedLaws).map(
      (listing) => [`years/${listing.year}.json`, listing] as const
    ),
    [
      "drafts.json",
      data
        .loadRuus()
        .filter((draft) => paths.has(`/ruu/${draft.slug}/`))
        .map(draftListing),
    ],
  ] as const;

  await Promise.all(
    lists.map(async ([name, listing]) => {
      await writeJson(path.join(listings, name), JSON.stringify(listing));
    })
  );
};
