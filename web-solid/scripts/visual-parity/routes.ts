export type Site = "astro" | "solid";

export interface Route {
  id: string;
  path: string;
  /** The address on the Astro site, where it differs. */
  astroPath?: string;
  formats?: readonly string[];
  viewportOnly?: boolean;
  status?: number;
  waitFor?: Partial<Record<Site, string>>;
}

const OLDER = "ruu_perampasan-aset_2023-05_draft_pemerintah";
const NEWER = "ruu_perampasan-aset_2026-11-19_draft-final";
const LAW_FORMATS = ["modern", "asli"] as const;

export const ROUTES: readonly Route[] = [
  { id: "home", path: "/" },
  { id: "tentang", path: "/tentang/" },
  { id: "uu-index", path: "/uu/" },
  { id: "uu-tahun", path: "/uu/tahun/2008/" },
  { id: "law", path: "/uu/11/2008/", formats: LAW_FORMATS },
  {
    id: "law-compare",
    path: "/uu/11/2008/?v=uu_11_2008,uu_1_2024",
    astroPath: "/uu/11/2008/?bandingkan=uu_1_2024&dari=uu_11_2008",
    formats: LAW_FORMATS,
    waitFor: { astro: "html[data-compare]", solid: "[data-compared]" },
  },
  { id: "law-large", path: "/uu/11/2020/", viewportOnly: true },
  { id: "koleksi-index", path: "/koleksi/" },
  { id: "koleksi-ite", path: "/koleksi/ite/" },
  { id: "ruu-index", path: "/ruu/" },
  { id: "ruu-draft", path: "/ruu/perampasan-aset/" },
  { id: "ruu-document", path: `/ruu/perampasan-aset/${NEWER}/` },
  { id: "ruu-compare", path: `/ruu/perampasan-aset/beda/${OLDER}...${NEWER}/` },
  {
    id: "cari",
    path: "/cari/?q=informasi+elektronik",
    waitFor: { astro: "#results a" },
  },
  { id: "not-found", path: "/tidak-ada/", status: 404 },
];

export const DEFAULT_WIDTHS: readonly number[] = [1280, 390];
export const SCHEMES = ["light", "dark"] as const;

export type Scheme = (typeof SCHEMES)[number];
