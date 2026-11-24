import { glob, writeFile } from "node:fs/promises";
import path from "node:path";

import { fromInvocation, searchCatalog } from "./astro-data.ts";

const [stage] = process.argv.slice(2);

if (stage === undefined) {
  throw new Error("Use pnpm run export-catalog <release-directory>.");
}

const destination = fromInvocation(stage);

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
