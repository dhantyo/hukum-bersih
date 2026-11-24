import { spawnSync } from "node:child_process";
import {
  glob,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { handleRequest } from "../dist/server/server.js";
import type { CorpusBucket } from "../src/server/corpus.ts";

const renderDocument = async (
  releaseDirectory: string,
  site: string,
  pagePath: string,
  key: string
) => {
  const corpus: CorpusBucket = {
    async get(requestKey) {
      if (requestKey === "active-release") {
        return new Response("staging");
      }

      if (requestKey !== `releases/staging/${key}`) {
        return null;
      }

      return new Response(await readFile(path.join(releaseDirectory, key)));
    },
  };

  const response = await handleRequest(
    new Request(`https://index.invalid${pagePath}`),
    { event: { locals: { corpus } } }
  );

  if (!response.ok) {
    throw new Error(`Could not render ${pagePath}: ${response.status}`);
  }

  const destination = path.join(site, pagePath, "index.html");
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, await response.text());
};

const runPagefind = (site: string, output: string) => {
  const pagefind = spawnSync(
    "pagefind",
    ["--site", site, "--output-path", output],
    { stdio: "inherit" }
  );

  if (pagefind.error) {
    throw pagefind.error;
  }

  if (pagefind.status !== 0) {
    throw new Error(`Pagefind exited with status ${pagefind.status}`);
  }
};

export const indexCorpus = async (releaseDirectory: string) => {
  const site = await mkdtemp(path.join(tmpdir(), "hukum-pagefind-"));

  const scratch = await mkdtemp(
    path.join(path.resolve(releaseDirectory), ".pagefind-")
  );

  try {
    let count = 0;

    for await (const file of glob("uu/*/*/index.json", {
      cwd: path.join(releaseDirectory, "laws"),
    })) {
      await renderDocument(
        releaseDirectory,
        site,
        `/${file.slice(0, -"index.json".length)}`,
        `laws/${file}`
      );
      count += 1;
    }

    if (count === 0) {
      throw new Error("The release has no law documents to index");
    }

    for await (const file of glob("drafts/*/documents/*.json", {
      cwd: releaseDirectory,
    })) {
      const [, slug, , document] = file.split("/");
      await renderDocument(
        releaseDirectory,
        site,
        `/ruu/${slug}/${document.slice(0, -".json".length)}/`,
        file
      );
    }

    runPagefind(site, scratch);
    await rename(scratch, path.resolve(releaseDirectory, "pagefind"));
  } finally {
    await rm(scratch, { recursive: true, force: true });
    await rm(site, { recursive: true, force: true });
  }
};
