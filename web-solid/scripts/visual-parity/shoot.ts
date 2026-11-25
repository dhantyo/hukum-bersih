import type { Browser, Page } from "playwright-core";

import type { Route, Scheme, Site } from "./routes.ts";

export const VIEWPORT_HEIGHT = 900;
const MAX_PAGE_HEIGHT = 15_000;
const NAV_TIMEOUT_MS = 60_000;
const STEADY_POLLS = 3;
const POLL_MS = 100;
const SETTLE_MS = 250;
const OK = 200;

const FREEZE_CSS =
  "*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important;caret-color:transparent!important}";

export interface Shot {
  png: Buffer;
  pageHeight: number;
  truncated: boolean;
}

export interface ShotJob {
  site: Site;
  route: Route;
  url: string;
  width: number;
  scheme: Scheme;
  format: string;
}

const pageHeight = async (page: Page) =>
  await page.evaluate(() => document.documentElement.scrollHeight);

const waitSteady = async (page: Page, last = -1, steady = 0) => {
  if (steady >= STEADY_POLLS) {
    return;
  }

  const height = await pageHeight(page);
  await page.waitForTimeout(POLL_MS);
  await waitSteady(page, height, height === last ? steady + 1 : 0);
};

const settle = async (page: Page, job: ShotJob) => {
  await page.addStyleTag({ content: FREEZE_CSS });
  const selector = job.route.waitFor?.[job.site];

  if (selector !== undefined) {
    await page.waitForSelector(selector, { timeout: NAV_TIMEOUT_MS });
    await page.waitForLoadState("networkidle");
  }

  await page.evaluate(async () => await document.fonts.ready);
  await waitSteady(page);
  await page.waitForTimeout(SETTLE_MS);
};

export const shoot = async (browser: Browser, job: ShotJob) => {
  const { route, width, scheme, format, url, site } = job;

  const context = await browser.newContext({
    viewport: { width, height: VIEWPORT_HEIGHT },
    colorScheme: scheme,
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
    locale: "id-ID",
  });

  await context.addInitScript((choice) => {
    localStorage.setItem("hb-format", choice);
    localStorage.setItem("hb-view", JSON.stringify({ format: choice }));
  }, format);

  try {
    const page = await context.newPage();

    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: NAV_TIMEOUT_MS,
    });

    const expected = route.status ?? OK;

    if (response?.status() !== expected) {
      throw new Error(
        `${site} ${url} answered ${response?.status()}, expected ${expected}`
      );
    }

    await settle(page, job);
    const height = await pageHeight(page);

    const shotHeight =
      route.viewportOnly === true
        ? VIEWPORT_HEIGHT
        : Math.min(height, MAX_PAGE_HEIGHT);

    const png = await page.screenshot({
      fullPage: true,
      clip: { x: 0, y: 0, width, height: shotHeight },
      animations: "disabled",
      caret: "hide",
    });

    return {
      png,
      pageHeight: height,
      truncated: route.viewportOnly !== true && height > shotHeight,
    };
  } finally {
    await context.close();
  }
};
