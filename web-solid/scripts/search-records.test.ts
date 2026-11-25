import { describe, expect, it } from "vitest";

import type { AknNode } from "../../web/src/lib/lawdoc.ts";
import type { ReaderText } from "../src/server/records/reader-text.ts";
import { textRecords } from "./search-records.ts";

const paragraph = (eId: string, text: string) =>
  ({
    tag: "p",
    eId,
    text,
    children: [],
  }) satisfies AknNode;

const article = (eId: string, num: string, ...texts: string[]) =>
  ({
    tag: "article",
    eId,
    num,
    children: texts.map((text, index) => paragraph(`${eId}__p_${index}`, text)),
  }) satisfies AknNode;

const emptyText: ReaderText = {
  preface: [],
  preamble: [],
  body: [],
  conclusions: [],
  penjelasan: [],
  anchors: {},
};

const records = (text: Partial<ReaderText>) =>
  textRecords("/uu/1/2000/", "Contoh", { ...emptyText, ...text });

describe(textRecords, () => {
  it("opens an article at its short alias and keeps the ayat numbers in the text", () => {
    const [record] = records({
      body: [
        {
          tag: "chapter",
          eId: "chp_I",
          num: "I",
          heading: "KETENTUAN UMUM",
          children: [
            {
              tag: "article",
              eId: "chp_I__art_27",
              num: "27",
              children: [
                {
                  tag: "paragraph",
                  num: "(1)",
                  children: [paragraph("p", "Setiap orang wajib.")],
                },
              ],
            },
          ],
        },
      ],
      anchors: { chp_I__art_27: "pasal-27" },
    });

    expect(record).toStrictEqual({
      url: "/uu/1/2000/#pasal-27",
      content: "Pasal 27. (1) Setiap orang wajib.",
      language: "id",
      meta: { title: "Contoh", label: "Pasal 27" },
    });
  });

  it("falls back to the element id when an article has no alias", () => {
    const [record] = records({ body: [article("art_1", "1", "Isi.")] });

    expect(record.url).toBe("/uu/1/2000/#art_1");
  });

  it("indexes the Penjelasan of an article, not a bare 'Cukup jelas'", () => {
    const found = records({
      penjelasan: [
        {
          tag: "part",
          eId: "att_1__part_II",
          num: "II",
          heading: "PASAL DEMI PASAL",
          children: [
            article("att_1__art_1", "1", "Cukup jelas."),
            article("att_1__art_2", "2", "Yang dimaksud dengan asas."),
          ],
        },
      ],
    });

    expect(found.map(({ url, meta }) => [url, meta.label])).toStrictEqual([
      ["/uu/1/2000/#penjelasan-att_1__art_2", "Pasal 2 Penjelasan"],
    ]);
  });

  it("indexes the opening, the closing and an unnumbered Penjelasan block", () => {
    const found = records({
      preface: [paragraph("preface__p_1", "UNDANG-UNDANG NOMOR 1 TAHUN 2000")],
      conclusions: [paragraph("conclusions__p_1", "Disahkan di Djakarta.")],
      penjelasan: [
        {
          tag: "part",
          eId: "att_1__part_I",
          num: "I",
          heading: "UMUM",
          children: [paragraph("att_1__part_I__p_1", "Uraian umum.")],
        },
      ],
    });

    expect(found.map(({ url, meta }) => [url, meta.label])).toStrictEqual([
      ["/uu/1/2000/", "Pembukaan"],
      ["/uu/1/2000/#penutup", "Pengesahan dan pengundangan"],
      ["/uu/1/2000/#penjelasan-att_1__part_I", "Penjelasan I UMUM"],
    ]);
  });

  it("finds nothing to index in an empty text or in text with no words", () => {
    expect(records({})).toStrictEqual([]);
    expect(
      records({ penjelasan: [paragraph("att_1__p_2", ".")] })
    ).toStrictEqual([]);
  });
});
