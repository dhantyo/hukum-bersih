import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
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

import * as v from "valibot";

import { isPresent } from "../src/lib/text.ts";

const pagefindEntry = v.object({
  languages: v.optional(
    v.record(v.string(), v.object({ page_count: v.number() }))
  ),
});

const USAGE =
  "Use publish <indexed-directory> or activate <release-id> with either HUKUM_CORPUS_DIR or HUKUM_CORPUS_REMOTE.";

const READY_FILE = "release-id";
const releaseIdPattern = /^[a-f0-9]{64}$/u;

const readTarget = () => {
  const root = process.env.HUKUM_CORPUS_DIR;
  const remote = process.env.HUKUM_CORPUS_REMOTE;

  if (isPresent(root) && !isPresent(remote)) {
    return { kind: "local", root } as const;
  }

  if (isPresent(remote) && !isPresent(root)) {
    return { kind: "r2", remote } as const;
  }

  throw new Error(USAGE);
};

type Target = ReturnType<typeof readTarget>;

const rclone = (...args: string[]) =>
  execFileSync("rclone", args, { encoding: "utf-8" });

const validateRelease = async (directory: string) => {
  const laws = await Array.fromAsync(
    glob("laws/uu/*/*/index.json", { cwd: directory })
  );

  if (laws.length === 0) {
    throw new Error("The release contains no law documents");
  }

  const entry = v.parse(
    pagefindEntry,
    JSON.parse(
      await readFile(
        path.join(directory, "pagefind/pagefind-entry.json"),
        "utf-8"
      )
    )
  );

  await readFile(path.join(directory, "pagefind/pagefind.js"));

  const searchable = Object.values(entry.languages ?? {}).some(
    (language) => language.page_count > 0
  );

  if (!searchable) {
    throw new Error("The release has no searchable Pagefind documents");
  }
};

const releaseDigest = async (directory: string) => {
  const entries = await Array.fromAsync(
    glob("**/*", { cwd: directory, withFileTypes: true })
  );

  const files = entries.filter((entry) => !entry.isDirectory());

  if (files.some((entry) => !entry.isFile())) {
    throw new Error("Release contents must be regular files");
  }

  const keys = files
    .map((entry) =>
      path.join(entry.parentPath, entry.name).slice(directory.length + 1)
    )
    .toSorted();

  const hash = createHash("sha256");

  for (const key of keys) {
    // oxlint-disable-next-line no-await-in-loop -- the digest hashes files in key order
    const content = await readFile(path.join(directory, key));
    const checksum = createHash("sha256").update(content).digest("hex");
    hash.update(`${JSON.stringify([key, checksum])}\n`);
  }

  return hash.digest("hex");
};

const assertReleaseReady = async (target: Target, release: string) => {
  if (!releaseIdPattern.test(release)) {
    throw new Error(`Invalid release ID: ${release}`);
  }

  const key = `releases/${release}/${READY_FILE}`;

  const marker =
    target.kind === "r2"
      ? rclone("cat", `${target.remote}/${key}`)
      : await readFile(path.join(target.root, key), "utf-8");

  if (marker.trim() !== release) {
    throw new Error(`Release ${release} is incomplete`);
  }
};

const storeRelease = async (
  target: Target,
  directory: string,
  release: string
) => {
  if (target.kind === "r2") {
    const prefix = `${target.remote}/releases/${release}`;
    rclone(
      "copy",
      directory,
      prefix,
      "--immutable",
      "--exclude",
      `/${READY_FILE}`
    );
    rclone(
      "copyto",
      path.join(directory, READY_FILE),
      `${prefix}/${READY_FILE}`,
      "--immutable"
    );

    return;
  }

  await mkdir(path.join(target.root, "releases"), { recursive: true });

  try {
    await rename(directory, path.join(target.root, "releases", release));
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : "";

    if (code !== "EEXIST" && code !== "ENOTEMPTY") {
      throw error;
    }

    await assertReleaseReady(target, release);
  }
};

const activateRelease = async (
  target: Target,
  scratch: string,
  release: string
) => {
  await assertReleaseReady(target, release);
  const pointer = path.join(scratch, "active-release");
  await writeFile(pointer, `${release}\n`, { flag: "wx" });

  if (target.kind === "r2") {
    rclone(
      "copyto",
      pointer,
      `${target.remote}/active-release`,
      "--ignore-times"
    );
  } else {
    await rename(pointer, path.join(target.root, "active-release"));
  }
};

const publishRelease = async (
  target: Target,
  scratch: string,
  source: string
) => {
  const directory = path.join(scratch, "release");
  await mkdir(directory);
  await Promise.all(
    ["laws", "pagefind", "law-catalog.json"].map(async (group) => {
      await cp(path.join(source, group), path.join(directory, group), {
        recursive: true,
      });
    })
  );

  for await (const group of glob("{collections,drafts}", { cwd: source })) {
    await cp(path.join(source, group), path.join(directory, group), {
      recursive: true,
    });
  }

  await validateRelease(directory);
  const release = await releaseDigest(directory);
  await writeFile(path.join(directory, READY_FILE), `${release}\n`, {
    flag: "wx",
  });
  await storeRelease(target, directory, release);

  return release;
};

const [command, argument] = process.argv.slice(2);

if (
  argument === undefined ||
  (command !== "publish" && command !== "activate")
) {
  throw new Error(USAGE);
}

const target = readTarget();

const stagingRoot =
  target.kind === "local" ? path.resolve(target.root) : tmpdir();

await mkdir(stagingRoot, { recursive: true });

const scratch = await mkdtemp(path.join(stagingRoot, ".corpus-release-"));

try {
  const release =
    command === "publish"
      ? await publishRelease(target, scratch, path.resolve(argument))
      : argument;

  await activateRelease(target, scratch, release);
  process.stdout.write(`${release}\n`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
