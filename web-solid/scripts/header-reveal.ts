/* oxlint-disable eslint/no-await-in-loop, unicorn/consistent-function-scoping */
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { chromium } from "playwright-core";

const DOWN_TO = 3000;
const DOWN_STEP = 100;
const UP_STEP = 20;
const UP_FRAMES = 15;
const FRAMES_PER_STEP = 3;
const SETTLE_MS = 600;
const VIEWPORT_HEIGHT = 800;
const TOLERANCE_PX = 0.5;

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

interface Frame {
  phase: string;
  scrollY: number;
  top: number;
  transform: string;
  position: string;
  mode: string;
}

interface Shift {
  at: number;
  value: number;
  fromHeader: boolean;
}

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  sources: { node: Node | null }[];
}

declare global {
  interface Window {
    hbFrames: Frame[];
    hbShifts: Shift[];
    hbPhase: string;
  }
}

const recordHeader = () => {
  const isLayoutShift = (entry: PerformanceEntry): entry is LayoutShiftEntry =>
    "value" in entry && "sources" in entry;

  const inHeader = (source: { node: Node | null }) =>
    source.node instanceof Element && source.node.closest("header") !== null;

  window.hbFrames = [];
  window.hbShifts = [];
  window.hbPhase = "load";

  const record = () => {
    const header = document.querySelector("header");

    if (header !== null) {
      const style = getComputedStyle(header);
      window.hbFrames.push({
        phase: window.hbPhase,
        scrollY: Math.round(scrollY),
        top: header.getBoundingClientRect().top,
        transform: style.transform,
        position: style.position,
        mode: header.dataset.mode ?? "",
      });
    }
  };

  const sample = () => {
    setTimeout(record, 0);
    requestAnimationFrame(sample);
  };

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (isLayoutShift(entry)) {
        window.hbShifts.push({
          at: entry.startTime,
          value: entry.value,
          fromHeader: entry.sources.some(inHeader),
        });
      }
    }
  }).observe({ type: "layout-shift", buffered: true });

  requestAnimationFrame(sample);
};

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    label: { type: "string", default: "page" },
    out: { type: "string" },
    chromium: { type: "string" },
    width: { type: "string", default: "1280" },
    reduced: { type: "boolean", default: false },
    "allow-header-shift": { type: "boolean", default: false },
  },
});

const [url] = positionals;

if (url === undefined) {
  throw new Error("Usage: header-reveal.ts <url> [--label x] [--out file]");
}

const browser = await chromium.launch({ executablePath: values.chromium });

const context = await browser.newContext({
  viewport: { width: Number(values.width), height: VIEWPORT_HEIGHT },
  reducedMotion: values.reduced ? "reduce" : "no-preference",
});

const page = await context.newPage();

await page.addInitScript(recordHeader);

await page.goto(url, { waitUntil: "networkidle" });

await page.waitForTimeout(SETTLE_MS);

const setPhase = async (phase: string) => {
  await page.evaluate((name) => (window.hbPhase = name), phase);
};

const scrollTo = async (y: number) => {
  const before = await page.evaluate((to) => {
    window.scrollTo(0, to);

    return window.hbFrames.length;
  }, y);

  await page.waitForFunction(
    ({ seen, wanted }) => window.hbFrames.length >= seen + wanted,
    { seen: before, wanted: FRAMES_PER_STEP },
    { polling: "raf" }
  );
};

const scrollStart = await page.evaluate(() => performance.now());

await setPhase("down");

for (let y = DOWN_STEP; y <= DOWN_TO; y += DOWN_STEP) {
  await scrollTo(y);
}

await setPhase("settle");

await page.waitForTimeout(SETTLE_MS);

await setPhase("up");

for (let i = 1; i <= UP_FRAMES; i += 1) {
  await scrollTo(DOWN_TO - i * UP_STEP);
}

await setPhase("after");

await page.waitForTimeout(SETTLE_MS);

const frames = await page.evaluate(() => window.hbFrames);

const allShifts = await page.evaluate(() => window.hbShifts);

const shifts = allShifts.filter((shift) => shift.at >= scrollStart);

await browser.close();

const up = frames.filter((frame) => frame.phase === "up");
const worstTop = Math.max(...up.map((frame) => frame.top));

const headerShift = sum(
  shifts.filter((shift) => shift.fromHeader).map((shift) => shift.value)
);

const pageShift = sum(shifts.map((shift) => shift.value));

console.log(
  `${values.label}: while scrolling up, each frame as scrollY:top mode position transform`
);

console.log(
  up
    .map(
      (frame) =>
        `${frame.scrollY}:${frame.top.toFixed(1)} ${frame.mode} ${frame.position} ${frame.transform}`
    )
    .join(" | ")
);

console.log(
  `${values.label}: highest header top while revealing ${worstTop.toFixed(1)}px, layout shift while scrolling ${pageShift.toFixed(4)} (from the header ${headerShift.toFixed(4)})`
);

if (values.out !== undefined) {
  writeFileSync(values.out, JSON.stringify({ frames, shifts }, null, 2));
}

if (
  worstTop > TOLERANCE_PX ||
  (headerShift > 0 && !values["allow-header-shift"])
) {
  console.error(
    `${values.label}: FAIL the header did not enter from above the window`
  );
  process.exitCode = 1;
}
