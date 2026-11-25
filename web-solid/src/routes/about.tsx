import * as stylex from "@stylexjs/stylex";

import { Badge } from "../components/badge.tsx";
import { usePageDescription, usePageTitle } from "../lib/head.ts";
import { css } from "../styles/css.ts";
import { linkClass } from "../styles/link.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";

const styles = stylex.create({
  prose: { maxWidth: size.measure },
  lead: { color: color.textMuted, fontSize: size.lg },
  note: {
    color: color.textMuted,
    fontSize: size.sm,
    marginBlockStart: space.s4,
  },
});

const About = () => {
  usePageTitle(() => "Tentang");
  usePageDescription(
    "Tentang Hukum Bersih: sumber data, cara kerja, dan batasannya."
  );

  return (
    <main class={css(styles.prose)}>
      <h1>Tentang Hukum Bersih</h1>
      <p class={css(styles.lead)}>
        Hukum Bersih adalah layanan publik yang terbuka: teks peraturan
        Indonesia yang bersih dan mudah dibaca, serta pelacakan rancangan
        undang-undang beserta setiap versinya.
      </p>

      <h2>Dari mana datanya?</h2>
      <p>
        Undang-undang diambil dari{" "}
        <a class={linkClass} href="https://peraturan.bpk.go.id">
          peraturan.bpk.go.id
        </a>
        , Database Peraturan JDIH Badan Pemeriksa Keuangan (BPK). Undang-undang
        yang kami impor lebih dulu berasal dari{" "}
        <a class={linkClass} href="https://peraturan.go.id">
          peraturan.go.id
        </a>
        , situs peraturan yang dikelola Direktorat Jenderal Peraturan
        Perundang-undangan, Kementerian Hukum. Sumber setiap undang-undang
        tercantum di halamannya. Dokumen RUU diambil dari halaman legislasi DPR.
        Versi yang sudah dihapus dari situs resmi diambil dari Wayback Machine
        dan selalu diberi label <Badge tone="archive">Arsip</Badge>. Salinan
        dari media diberi label <Badge tone="media">Media</Badge>. Versi yang
        diketahui ada tetapi belum ditemukan berkasnya tetap dicantumkan dan
        tidak pernah direka ulang.
      </p>
      <p>
        Untuk setiap PDF asli kami mencatat alamat sumber dan sidik jari
        (SHA-256) agar dapat dipastikan berkasnya tidak berubah. Sebagian
        salinan lama tersimpan di{" "}
        <a class={linkClass} href="https://archive.org">
          archive.org
        </a>{" "}
        dan ditautkan di halaman undang-undangnya.
      </p>

      <h2>Seberapa akurat teksnya?</h2>
      <p>
        Teks diambil otomatis dari PDF resmi dan disusun menurut struktur BAB,
        Pasal, ayat, dan huruf. Kesalahan baca tetap mungkin terjadi; PDF
        resminya yang berlaku. PDF lama yang berupa hasil pindaian belum
        tersedia sebagai teks.
      </p>

      <h2>Bagaimana perbandingan versi bekerja?</h2>
      <p>
        Nomor pasal sering bergeser antarversi, jadi pasal dicocokkan
        berdasarkan isinya, lalu ayat demi ayat, lalu kata demi kata. Hasilnya
        ditampilkan berdampingan seperti tabel sinopsis atau DIM. Pencocokan
        dilakukan otomatis; periksa teks lengkapnya untuk kepastian.
      </p>

      <h2>Terbuka</h2>
      <p>
        Semua kode dan data ada di{" "}
        <a class={linkClass} href="https://github.com/dhantyo/hukum-bersih">
          GitHub
        </a>
        . Data berlisensi CC0 (domain publik), kode berlisensi AGPL-3.0. Teks
        peraturan perundang-undangan tidak dilindungi hak cipta (UU 28/2014
        Pasal 42).
      </p>
      <p class={css(styles.note)}>Ini bukan nasihat hukum.</p>
    </main>
  );
};

export default About;
