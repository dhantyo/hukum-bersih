import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import * as v from "valibot";

import { lawPath } from "../src/lib/schemas.ts";
import { isPresent } from "../src/lib/text.ts";
import {
  amendments,
  fromInvocation,
  lawtext,
  peraturan,
} from "./astro-data.ts";
import { readerText } from "./reader-text.ts";

type Regulation = ReturnType<typeof peraturan.loadRegulations>[number];

const [lawId, output] = process.argv.slice(2);

if (lawId === undefined || output === undefined) {
  throw new Error(
    "Use pnpm run export-law <law-id> <output.json> or pnpm run export-law --all <release-directory>."
  );
}

const destination = fromInvocation(output);

const readerAmendments = (
  regulation: Regulation,
  text: ReturnType<typeof peraturan.loadRegulationText>
) =>
  amendments
    .amendmentSteps(regulation, text)
    .map(({ by, changes, headerOnly, date, gap }) => {
      const href = peraturan.pathOf(by.id);

      return {
        id: by.id,
        label: peraturan.citeId(by.id),
        href: href === undefined ? undefined : `/${href}`,
        date,
        gap,
        instructions: headerOnly.map(({ header }) => header),
        changes: changes.map(
          ({ anchor, num, row, kind, missingBefore, missingAfter }) => ({
            anchor,
            num,
            kind,
            missingBefore,
            missingAfter,
            before: row.a ? lawtext.pasalText(row.a) : null,
            after: row.b ? lawtext.pasalText(row.b) : null,
          })
        ),
      };
    });

const readerLaw = (law: Regulation) => {
  const document = peraturan.loadRegulationText(law);

  if (!document && law.versions.some((version) => isPresent(version.text))) {
    throw new Error(`Generated Akoma Ntoso is missing for ${law.id}`);
  }

  return {
    path: `/${peraturan.lawPath(law)}`,
    title: law.title,
    subject: law.subject,
    shortName: amendments.shortName(law),
    status: law.status,
    source: law.source_url,
    pdf: law.source_pdf_url,
    archive: law.archive_url,
    text: document ? readerText(document) : null,
    amendments: readerAmendments(law, document),
  };
};

const writeLaw = (law: Regulation, file: string, flag = "w") => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(readerLaw(law))}\n`, { flag });
};

const exportCorpus = (laws: Regulation[], directory: string) => {
  if (laws.length === 0) {
    throw new Error("The corpus contains no laws");
  }

  mkdirSync(directory, { recursive: true });
  const scratch = mkdtempSync(path.join(directory, ".laws-"));

  try {
    for (const law of laws) {
      const lawDirectory = peraturan.lawPath(law);

      if (!v.is(lawPath, `/${lawDirectory}`)) {
        throw new Error(`Invalid law path: ${lawDirectory}`);
      }

      writeLaw(law, path.join(scratch, lawDirectory, "index.json"), "wx");
    }

    renameSync(scratch, path.join(directory, "laws"));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  console.log(`Exported ${laws.length} laws`);
};

const laws = peraturan.loadRegulations().filter((law) => law.type === "uu");

if (lawId === "--all") {
  exportCorpus(laws, destination);
} else {
  const law = laws.find((record) => record.id === lawId);

  if (!law) {
    throw new Error(`Unknown law: ${lawId}`);
  }

  writeLaw(law, destination);
}
