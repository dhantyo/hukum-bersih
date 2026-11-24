import { describe, expect, it } from "vitest";

import { parseLawRecord } from "./law.ts";

const path = "/uu/9/1960/";

const law = {
  path,
  title: "Undang-Undang Nomor 9 Tahun 1960",
  subject: "",
  source: "https://peraturan.bpk.go.id/",
  pdf: null,
  text: null,
  amendments: [],
};

describe(parseLawRecord, () => {
  it("a known law can be published before its text is available", () => {
    expect(parseLawRecord(JSON.stringify(law), path).text).toBeNull();
  });

  it.each([
    { path: "/uu/10/1960/" },
    { source: "file:///etc/passwd" },
    { text: { preface: [{ tag: "p", children: "x" }] } },
  ])("rejects an invalid published record: %j", (invalid) => {
    expect(() =>
      parseLawRecord(JSON.stringify({ ...law, ...invalid }), path)
    ).toThrow("Invalid published law");
  });
});
