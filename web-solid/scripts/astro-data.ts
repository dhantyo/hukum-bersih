import path from "node:path";
import { fileURLToPath } from "node:url";

const invocationDirectory = process.cwd();

process.chdir(fileURLToPath(new URL("../../web/", import.meta.url)));

export const fromInvocation = (location: string, ...rest: string[]) =>
  path.resolve(invocationDirectory, location, ...rest);

export const amendments = await import("../../web/src/lib/amendments.ts");
export const compare = await import("../../web/src/lib/compare.ts");
export const data = await import("../../web/src/lib/data.ts");
export const display = await import("../../web/src/lib/display.ts");
export const koleksi = await import("../../web/src/lib/koleksi.ts");
export const labels = await import("../../web/src/lib/labels.ts");
export const lawtext = await import("../../web/src/lib/lawtext.ts");
export const merge = await import("../../web/src/lib/merge.ts");
export const peraturan = await import("../../web/src/lib/peraturan.ts");

export const searchCatalog =
  await import("../../web/src/lib/search-catalog.ts");

export const versions = await import("../../web/src/lib/versions.ts");
