declare module "*/dist/server/server.js" {
  export const handleRequest: (
    request: Request,
    options: { event: { locals: import("@solidjs/web").RequestEventLocals } }
  ) => Promise<Response>;
}

interface CacheStorage {
  default: Cache;
}
