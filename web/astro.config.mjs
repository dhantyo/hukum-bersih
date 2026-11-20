import { defineConfig } from "astro/config";

// Static output, deployed to GitHub Pages. The deploy workflow passes the Pages origin and
// base path (e.g. "/hukum-bersih" until a custom domain is set); locally both are unset.
export default defineConfig({
  output: "static",
  site: process.env.SITE_ORIGIN || undefined,
  base: process.env.SITE_BASE || "/",
});
