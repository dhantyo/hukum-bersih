import { fromInvocation } from "./astro-data.ts";
import { exportCatalog } from "./export-catalog.ts";
import { exportCollections } from "./export-collections.ts";
import { exportDrafts } from "./export-drafts.ts";
import { exportLaws } from "./export-laws.ts";
import { indexCorpus } from "./index-corpus.ts";

const [argument] = process.argv.slice(2);

if (argument === undefined) {
  throw new Error("Use pnpm run export-corpus <release-directory>.");
}

const stage = fromInvocation(argument);

exportLaws(stage);

exportCollections(stage);

exportDrafts(stage);

await exportCatalog(stage);

await indexCorpus(stage);
