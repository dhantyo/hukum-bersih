const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** "2026-11-19" -> "19 November 2026", "2023-05" -> "Mei 2023", "2008" -> "2008". */
export const tanggal = (date: string) => {
  const [year, month, day] = date.split("-");

  if (month === undefined || month === "") {
    return year;
  }

  const name = MONTHS[Number(month) - 1];

  return day === undefined || day === ""
    ? `${name} ${year}`
    : `${Number(day)} ${name} ${year}`;
};

export const PROVENANCE = {
  official: {
    label: "Resmi",
    hint: "Diunduh dari situs resmi lembaga negara.",
  },
  archive: {
    label: "Arsip",
    hint: "Salinan dari arsip web; berkas aslinya sudah tidak tersedia di situs resmi.",
  },
  media: {
    label: "Media",
    hint: "Salinan yang beredar lewat media, bukan dari situs resmi.",
  },
  leak: {
    label: "Bocoran",
    hint: "Dokumen tidak resmi; keasliannya belum dapat dipastikan.",
  },
  none: {
    label: "Belum ditemukan",
    hint: "Versi ini diketahui ada, tetapi berkasnya belum ditemukan.",
  },
} as const;

export const provenanceKey = (
  provenance: "official" | "archive" | "media" | "leak" | null | undefined
) => provenance ?? "none";

const docTypes = new Map([
  ["draft", "Draf RUU"],
  ["draft-final", "Draf RUU Final"],
  ["naskah-akademik", "Naskah Akademik"],
  ["naskah-urgensi", "Naskah Urgensi"],
  ["dim", "Daftar Inventaris Masalah (DIM)"],
  ["surat-presiden", "Surat Presiden"],
  ["laporan-komisi", "Laporan Komisi"],
  ["tanggapan-pemerintah", "Tanggapan Pemerintah"],
  ["pandangan-mini-fraksi", "Pandangan Mini Fraksi"],
  ["risalah-rapat", "Risalah Rapat"],
  ["laporan-singkat", "Laporan Singkat"],
  ["bahan-narasumber", "Bahan Narasumber"],
  ["dokumen-pendukung", "Dokumen Pendukung"],
]);

const stages = new Map([
  ["surat_presiden", "Surat Presiden"],
  ["penyusunan_bkd", "Penyusunan oleh Badan Keahlian DPR"],
  ["penyusunan", "Penyusunan"],
  ["penetapan_usul_dpr", "Penetapan usul DPR"],
  ["dim_pemerintah", "DIM Pemerintah"],
  ["pembicaraan_tingkat_i", "Pembicaraan Tingkat I"],
  ["pembicaraan_tingkat_ii", "Pembicaraan Tingkat II (Rapat Paripurna)"],
  ["pengesahan", "Pengesahan"],
  ["pengundangan", "Pengundangan"],
]);

/** "draft-final" -> "Draf RUU Final"; a type with no label is shown as it is. */
export const docTypeLabel = (type: string) => docTypes.get(type) ?? type;

/** "pembicaraan_tingkat_i" -> "Pembicaraan Tingkat I"; a stage with no label is shown as it is. */
export const stageLabel = (stage: string) => stages.get(stage) ?? stage;

export const STATUS = {
  sama: "Tidak berubah",
  berubah: "Berubah",
  baru: "Baru",
  dihapus: "Dihapus",
} as const;
