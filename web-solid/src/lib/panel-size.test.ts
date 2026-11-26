import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

import {
  PANEL_REM,
  PANEL_WIDTH_KEY,
  parseWidth,
  WIDTH_SCRIPT,
} from "./panel-size.ts";

const runScript = (stored: string | null) => {
  const properties = new Map<string, string>();

  const parentElement = {
    style: {
      setProperty: (name: string, value: string) => properties.set(name, value),
    },
  };

  runInNewContext(WIDTH_SCRIPT, {
    document: { currentScript: { parentElement } },
    localStorage: {
      getItem: (key: string) => (key === PANEL_WIDTH_KEY ? stored : null),
    },
  });

  return properties.get("--resizable-panel-size");
};

describe(parseWidth, () => {
  it("accepts a width a reader can drag to", () => {
    expect(parseWidth("17")).toBe(17);
    expect(parseWidth("20.25")).toBe(20.25);
    expect(parseWidth(String(PANEL_REM.min))).toBe(PANEL_REM.min);
    expect(parseWidth(String(PANEL_REM.max))).toBe(PANEL_REM.max);
  });

  it("rejects what is missing or malformed", () => {
    expect(parseWidth(null)).toBeNull();
    expect(parseWidth("")).toBeNull();
    expect(parseWidth("wide")).toBeNull();
    expect(parseWidth("1e1")).toBeNull();
  });

  it("rejects a width outside the range", () => {
    expect(parseWidth("12.99")).toBeNull();
    expect(parseWidth("24.01")).toBeNull();
  });
});

describe(WIDTH_SCRIPT, () => {
  it("sets the saved width on the script's parent before first paint", () => {
    expect(runScript("20.25")).toBe("20.25rem");
  });

  it("leaves the default alone for a value parseWidth rejects", () => {
    expect(runScript("99")).toBeUndefined();
    expect(runScript("wide")).toBeUndefined();
    expect(runScript(null)).toBeUndefined();
  });
});
