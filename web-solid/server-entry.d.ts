// The built server entry has no declarations of its own. The index script and the Worker import it.
declare module "*/dist/server/server.js" {
  export const handleRequest: (
    request: Request,
    options: { event: { locals: import("@solidjs/web").RequestEventLocals } }
  ) => Promise<Response>;
}
