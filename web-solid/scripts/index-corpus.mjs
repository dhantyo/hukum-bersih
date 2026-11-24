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
import { dirname, join, resolve } from "node:path";

import { handleRequest } from "../dist/server/server.js";

const [releaseDirectory] = process.argv.slice(2);

if (!releaseDirectory) {
  throw new Error("Usage: pnpm run index-corpus <release-directory>");
}

async function renderDocument(site, path, key) {
  const corpus = {
    async get(requestKey) {
      if (requestKey === "active-release") {
        return new Response("staging");
      }

      if (requestKey !== `releases/staging/${key}`) {
        return null;
      }

      return new Response(await readFile(join(releaseDirectory, key)));
    },
  };

  const response = await handleRequest(
    new Request(`https://index.invalid${path}`),
    {
      event: { locals: { corpus } },
    }
  );

  if (!response.ok) {
    throw new Error(`Could not render ${path}: ${response.status}`);
  }

  const destination = join(site, path, "index.html");
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, await response.text());
}

function runPagefind(site, output) {
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
}

const site = await mkdtemp(join(tmpdir(), "hukum-pagefind-"));
const scratch = await mkdtemp(join(resolve(releaseDirectory), ".pagefind-"));

try {
  let count = 0;

  for await (const file of glob("uu/*/*/index.json", {
    cwd: join(releaseDirectory, "laws"),
  })) {
    await renderDocument(
      site,
      `/${file.slice(0, -"index.json".length)}`,
      `laws/${file}`
    );
    count++;
  }

  if (!count) {
    throw new Error("The release has no law documents to index");
  }

  for await (const file of glob("drafts/*/documents/*.json", {
    cwd: releaseDirectory,
  })) {
    const [, slug, , document] = file.split("/");
    await renderDocument(
      site,
      `/ruu/${slug}/${document.slice(0, -".json".length)}/`,
      file
    );
  }

  runPagefind(site, scratch);
  await rename(scratch, resolve(releaseDirectory, "pagefind"));
} finally {
  await rm(scratch, { recursive: true, force: true });
  await rm(site, { recursive: true, force: true });
}
