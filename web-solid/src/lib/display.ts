import type { AknNode } from "../server/records/reader-text.ts";

const SMALL = new Set([
  "dan",
  "atau",
  "di",
  "ke",
  "dari",
  "yang",
  "untuk",
  "tentang",
  "atas",
  "terhadap",
  "dengan",
  "pada",
  "dalam",
  "oleh",
  "serta",
  "bagi",
  "sebagai",
  "antara",
  "menjadi",
  "kepada",
  "tanpa",
  "melalui",
  "secara",
  "beserta",
  "mengenai",
  "of",
  "the",
]);

const KEEP_UPPER =
  /^(?:[IVXLC]+|RI|NRI|NKRI|DPR|DPRD|DPD|MPR|BPK|BPKP|KPK|OJK|BI|APBN|APBD|KUHP|KUHAP|ITE|TNI|POLRI|BUMN|BUMD|BUMDES|PNPS|UUD|UU|PP|HAM|ASN|PNS|BPJS|LN|TLN|IUP|IUPK|IPR|WIUP|WIUPK|WPR|WUP|WPN|WP|AMDAL|NPWP|PPN|PPH|PPNBM|PBB|SDA|SDM)$/u;

const LOWER_CASE = /[a-z]/u;
const WORD_BREAK = /(?<break>\s+|-|\/|\()/u;
const LEADING_SPACE = /^\s+/u;
const AYAT = /^ayat\s*(?<label>\(\s*\d+[a-z]?\s*\))$/iu;
const HURUF = /^huruf\s+(?<label>[a-z]{1,2})\.?$/iu;
const ANGKA = /^angka\s+(?<label>\d+[a-z]?)\.?$/iu;
const WHITESPACE = /\s+/gu;
const NOT_KEY = /[^0-9a-z]+/gu;
const CUKUP_JELAS = /^cukup\s+jelas\.?$/iu;

const judul = (text: string) =>
  text
    .toLowerCase()
    .split(WORD_BREAK)
    .map((word, index) => {
      if (!LOWER_CASE.test(word)) {
        return word;
      }

      const upper = word.toUpperCase();

      if (KEEP_UPPER.test(upper)) {
        return upper;
      }

      if (index > 0 && SMALL.has(word)) {
        return word;
      }

      return `${word[0].toUpperCase()}${word.slice(1)}`;
    })
    .join("")
    .replace(LEADING_SPACE, "");

/** Headings in normal capitals for Modern: "KETENTUAN UMUM" -> "Ketentuan Umum". Text that is
 * not written in capitals is left as it is. */
export const modernHeading = (text: string) =>
  LOWER_CASE.test(text) ? text : judul(text);

/** Penjelasan labels in the body's style: "Ayat (1)" -> "(1)", "Huruf d" -> "d.",
 * "Angka 3" -> "3."; anything else unchanged. */
export const modernLabel = (num: string) => {
  const ayat = AYAT.exec(num)?.groups?.label;

  if (ayat !== undefined) {
    return ayat.replaceAll(WHITESPACE, "");
  }

  const huruf = HURUF.exec(num)?.groups?.label;

  if (huruf !== undefined) {
    return `${huruf}.`;
  }

  const angka = ANGKA.exec(num)?.groups?.label;

  return angka === undefined ? num : `${angka}.`;
};

/** Key used in pasal anchors: "27" -> "27", "45A" -> "45a". */
export const pasalKey = (num: string) =>
  num.toLowerCase().replaceAll(NOT_KEY, "");

const texts = (root: AknNode) => {
  const found: string[] = [];

  const visit = (node: AknNode) => {
    if (node.tag === "p") {
      found.push(node.text ?? "");

      return;
    }

    for (const child of node.children) {
      visit(child);
    }
  };

  visit(root);

  return found;
};

/** True when everything a Penjelasan entry says is "Cukup jelas." */
export const cukupJelas = (node: AknNode) => {
  const found = texts(node).filter((text) => text.trim() !== "");

  return (
    found.length > 0 && found.every((text) => CUKUP_JELAS.test(text.trim()))
  );
};

const PREVIEW_LENGTH = 90;
const TRAILING_WORD = /\s+\S*$/u;

/** First words of a pasal, shown next to its heading while it is folded. */
export const preview = (node: AknNode, max = PREVIEW_LENGTH) => {
  const text = texts(node).join(" ").replaceAll(WHITESPACE, " ").trim();

  return text.length > max
    ? `${text.slice(0, max).replace(TRAILING_WORD, "")}…`
    : text;
};
