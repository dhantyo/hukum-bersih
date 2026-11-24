import { expect, test } from "vitest";

import { parseLawRecord } from "./law-record";

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

test("a known law can be published before its text is available", () => {
  expect(parseLawRecord(law, path).text).toBeNull();
});

test.each([{ path: "/uu/10/1960/" }, { source: "javascript:alert(1)" }])(
  "rejects a record with invalid public links: %j",
  (invalid) => {
    expect(() => parseLawRecord({ ...law, ...invalid }, path)).toThrow(
      "Invalid published law"
    );
  }
);
