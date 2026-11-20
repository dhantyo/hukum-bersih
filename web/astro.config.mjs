import { defineConfig } from "astro/config";

// Static output only. Deploy target (GitHub Pages vs Cloudflare Pages) and domain are still open.
export default defineConfig({
  output: "static",
});
