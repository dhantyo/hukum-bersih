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
import { join, resolve } from "node:path";

type Target = { kind: "local"; root: string } | { kind: "r2"; remote: string };

interface PagefindEntry {
  languages?: Record<string, { page_count: number }>;
}

const USAGE =
  "Use publish <indexed-directory> or activate <release-id> with either HUKUM_CORPUS_DIR or HUKUM_CORPUS_REMOTE.";

const READY_FILE = "release-id";
const releaseIdPattern = /^[a-f0-9]{64}$/u;

const readTarget = (): Target => {
  const root = process.env.HUKUM_CORPUS_DIR;
  const remote = process.env.HUKUM_CORPUS_REMOTE;

  if (Boolean(root) === Boolean(remote)) {
    throw new Error(USAGE);
  }

  return root
    ? { kind: "local", root }
    : { kind: "r2", remote: remote as string };
};

const rclone = (...args: string[]) =>
  execFileSync("rclone", args, { encoding: "utf-8" });

const validateRelease = async (directory: string) => {
  const laws = await Array.fromAsync(
    glob("laws/uu/*/*/index.json", { cwd: directory })
  );

  if (laws.length === 0) {
    throw new Error("The release contains no law documents");
  }

  const entry = JSON.parse(
    await readFile(join(directory, "pagefind/pagefind-entry.json"), "utf-8")
  ) as PagefindEntry;

  await readFile(join(directory, "pagefind/pagefind.js"));

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
      join(entry.parentPath, entry.name).slice(directory.length + 1)
    )
    .toSorted();

  const hash = createHash("sha256");

  for (const key of keys) {
    // oxlint-disable-next-line no-await-in-loop -- the digest hashes files in key order
    const content = await readFile(join(directory, key));
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
      : await readFile(join(target.root, key), "utf-8");

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
      join(directory, READY_FILE),
      `${prefix}/${READY_FILE}`,
      "--immutable"
    );

    return;
  }

  await mkdir(join(target.root, "releases"), { recursive: true });

  try {
    await rename(directory, join(target.root, "releases", release));
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;

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
  const pointer = join(scratch, "active-release");
  await writeFile(pointer, `${release}\n`, { flag: "wx" });

  if (target.kind === "r2") {
    rclone(
      "copyto",
      pointer,
      `${target.remote}/active-release`,
      "--ignore-times"
    );
  } else {
    await rename(pointer, join(target.root, "active-release"));
  }
};

const publishRelease = async (
  target: Target,
  scratch: string,
  source: string
) => {
  const directory = join(scratch, "release");
  await mkdir(directory);
  await Promise.all(
    ["laws", "pagefind", "law-catalog.json"].map(async (group) => {
      await cp(join(source, group), join(directory, group), {
        recursive: true,
      });
    })
  );

  for await (const group of glob("{collections,drafts}", { cwd: source })) {
    await cp(join(source, group), join(directory, group), { recursive: true });
  }

  await validateRelease(directory);
  const release = await releaseDigest(directory);
  await writeFile(join(directory, READY_FILE), `${release}\n`, { flag: "wx" });
  await storeRelease(target, directory, release);

  return release;
};

const [command, argument] = process.argv.slice(2);

if (!argument || (command !== "publish" && command !== "activate")) {
  throw new Error(USAGE);
}

const target = readTarget();

const stagingRoot = target.kind === "local" ? resolve(target.root) : tmpdir();

await mkdir(stagingRoot, { recursive: true });

const scratch = await mkdtemp(join(stagingRoot, ".corpus-release-"));

try {
  const release =
    command === "publish"
      ? await publishRelease(target, scratch, resolve(argument))
      : argument;

  await activateRelease(target, scratch, release);
  process.stdout.write(`${release}\n`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
