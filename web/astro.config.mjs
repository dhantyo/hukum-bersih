import { defineConfig } from "astro/config";

// Static output, deployed to Cloudflare at the domain root (see wrangler.jsonc).
export default defineConfig({
  output: "static",
});
