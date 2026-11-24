// Words kept lowercase inside Indonesian titles (except at the start).
const SMALL = new Set(["dan", "atau", "di", "ke", "dari", "yang", "untuk", "tentang", "atas",
  "terhadap", "dengan", "pada", "dalam", "oleh", "serta", "bagi", "sebagai", "antara", "menjadi",
  "kepada", "tanpa", "melalui", "secara", "beserta", "mengenai", "of", "the"]);
// Acronyms and roman numerals stay upper case.
// (also used for law headings in the "Modern" view, so legal abbreviations are listed too)
const KEEP_UPPER = /^(?:[IVXLC]+|RI|NRI|NKRI|DPR|DPRD|DPD|MPR|BPK|BPKP|KPK|OJK|BI|APBN|APBD|KUHP|KUHAP|ITE|TNI|POLRI|BUMN|BUMD|BUMDES|PNPS|UUD|UU|PP|HAM|ASN|PNS|BPJS|LN|TLN|IUP|IUPK|IPR|WIUP|WIUPK|WPR|WUP|WPN|WP|AMDAL|NPWP|PPN|PPH|PPNBM|PBB|SDA|SDM)$/;

/** "PELINDUNGAN SAKSI DAN KORBAN" -> "Pelindungan Saksi dan Korban". */
export function judul(text: string): string {
  return text.toLowerCase().split(/(\s+|-|\/|\()/).map((w, k) => {
    if (!/[a-z]/.test(w)) return w;
    const up = w.toUpperCase();
    if (KEEP_UPPER.test(up)) return up;
    if (k > 0 && SMALL.has(w)) return w;
    return w[0].toUpperCase() + w.slice(1);
  }).join("").replace(/^\s+/, "");
}
