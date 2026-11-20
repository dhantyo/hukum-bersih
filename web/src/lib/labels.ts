// Indonesian UI labels.
import type { Provenance } from "./data.ts";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus",
  "September", "Oktober", "November", "Desember"];

/** "2026-11-19" -> "19 November 2026", "2023-05" -> "Mei 2023", "2008" -> "2008". */
export function tanggal(date: string): string {
  const [y, m, d] = date.split("-");
  if (!m) return y;
  const bulan = BULAN[Number(m) - 1];
  return d ? `${Number(d)} ${bulan} ${y}` : `${bulan} ${y}`;
}

export const PROVENANCE: Record<string, { label: string; hint: string }> = {
  official: { label: "Resmi", hint: "Diunduh dari situs resmi lembaga negara." },
  archive: { label: "Arsip", hint: "Salinan dari arsip web; berkas aslinya sudah tidak tersedia di situs resmi." },
  media: { label: "Media", hint: "Salinan yang beredar lewat media, bukan dari situs resmi." },
  leak: { label: "Bocoran", hint: "Dokumen tidak resmi; keasliannya belum dapat dipastikan." },
  none: { label: "Belum ditemukan", hint: "Versi ini diketahui ada, tetapi berkasnya belum ditemukan." },
};

export const provenanceKey = (p: Provenance) => p ?? "none";

export const DOC_TYPE: Record<string, string> = {
  "draft": "Draf RUU",
  "draft-final": "Draf RUU Final",
  "naskah-akademik": "Naskah Akademik",
  "naskah-urgensi": "Naskah Urgensi",
  "dim": "Daftar Inventaris Masalah (DIM)",
  "surat-presiden": "Surat Presiden",
  "laporan-komisi": "Laporan Komisi",
  "tanggapan-pemerintah": "Tanggapan Pemerintah",
  "pandangan-mini-fraksi": "Pandangan Mini Fraksi",
  "risalah-rapat": "Risalah Rapat",
  "laporan-singkat": "Laporan Singkat",
  "bahan-narasumber": "Bahan Narasumber",
  "dokumen-pendukung": "Dokumen Pendukung",
};

export const STAGE: Record<string, string> = {
  surat_presiden: "Surat Presiden",
  penyusunan_bkd: "Penyusunan oleh Badan Keahlian DPR",
  penyusunan: "Penyusunan",
  penetapan_usul_dpr: "Penetapan usul DPR",
  dim_pemerintah: "DIM Pemerintah",
  pembicaraan_tingkat_i: "Pembicaraan Tingkat I",
  pembicaraan_tingkat_ii: "Pembicaraan Tingkat II (Rapat Paripurna)",
  pengesahan: "Pengesahan",
  pengundangan: "Pengundangan",
};

export const STATUS: Record<string, string> = {
  sama: "Tidak berubah",
  berubah: "Berubah",
  baru: "Baru",
  dihapus: "Dihapus",
};
