import { spawn } from "node:child_process";
import { once } from "node:events";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { fail, ROOT } from "./options.ts";
import type { Site } from "./routes.ts";

export const PORTS: Record<Site, number> = { astro: 4331, solid: 3331 };

export const originOf = (site: Site) => `http://localhost:${PORTS[site]}`;

const START_ATTEMPTS = 100;
const START_POLL_MS = 200;
const NOT_FOUND = 404;
const OK = 200;

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
  [".woff", "font/woff"],
  [".wasm", "application/wasm"],
  [".txt", "text/plain; charset=utf-8"],
]);

const sendFile = (res: ServerResponse, file: string, status: number) => {
  res.writeHead(status, {
    "content-type": MIME.get(path.extname(file)) ?? "application/octet-stream",
  });
  createReadStream(file).pipe(res);
};

const isFile = async (candidate: string) => {
  const info = await stat(candidate).catch(() => null);

  return info?.isFile() === true;
};

const findFile = async (dist: string, pathname: string) => {
  const base = path.join(
    dist,
    decodeURIComponent(pathname).replaceAll("\0", "")
  );

  if (!base.startsWith(dist)) {
    return null;
  }

  const candidates = [base, path.join(base, "index.html"), `${base}.html`];
  const found = await Promise.all(candidates.map(isFile));

  return candidates[found.indexOf(true)] ?? null;
};

const answer = async (
  dist: string,
  req: IncomingMessage,
  res: ServerResponse
) => {
  const file = await findFile(
    dist,
    new URL(req.url ?? "/", "http://x").pathname
  );

  if (file === null) {
    sendFile(res, path.join(dist, "404.html"), NOT_FOUND);

    return;
  }

  sendFile(res, file, OK);
};

export const serveAstro = async (dist: string) => {
  const server = createServer((req, res) => {
    answer(dist, req, res).catch(() => {
      res.destroy();
    });
  });

  server.listen(PORTS.astro, "127.0.0.1");
  await once(server, "listening");

  return server;
};

const isUp = async (origin: string) => {
  try {
    await fetch(`${origin}/`);

    return true;
  } catch {
    return false;
  }
};

const waitUp: (origin: string, attempt?: number) => Promise<boolean> = async (
  origin,
  attempt = 0
) => {
  if (await isUp(origin)) {
    return true;
  }

  if (attempt >= START_ATTEMPTS) {
    return false;
  }

  await sleep(START_POLL_MS);

  return await waitUp(origin, attempt + 1);
};

export const startSolid = async (corpus: string) => {
  const child = spawn("node", [path.join(ROOT, "dist/server/node.js")], {
    cwd: ROOT,
    env: {
      ...process.env,
      HUKUM_CORPUS_DIR: corpus,
      PORT: String(PORTS.solid),
    },
    stdio: "ignore",
  });

  if (!(await waitUp(originOf("solid")))) {
    child.kill();
    fail("the Solid server did not start");
  }

  return child;
};
