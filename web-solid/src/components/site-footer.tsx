import * as stylex from "@stylexjs/stylex";

import { slashed } from "../lib/paths.ts";
import { Router } from "../router.tsx";
import { css } from "../styles/css.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";

const styles = stylex.create({
  footer: {
    backgroundColor: color.backgroundSubtle,
    borderBlockStartColor: color.line,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: 1,
    marginBlockStart: space.s8,
  },
  inner: {
    marginInline: "auto",
    paddingInline: space.s4,
    boxSizing: "border-box",
    paddingBlockEnd: space.s7,
    paddingBlockStart: space.s6,
    maxWidth: size.page,
  },
  note: {
    color: color.textMuted,
    fontSize: size.sm,
    maxWidth: size.measure,
  },
});

export const SiteFooter = () => (
  <footer class={css(styles.footer)}>
    <div class={css(styles.inner)}>
      <p class={css(styles.note)}>
        <strong>Hukum Bersih</strong> menyajikan teks peraturan dan rancangan
        undang-undang Indonesia apa adanya dari sumber resminya, dengan tautan
        ke berkas asli dan salinan arsipnya. Teks diambil otomatis dari PDF dan
        bisa memuat kesalahan baca; PDF resminya yang berlaku. Ini bukan nasihat
        hukum.
      </p>
      <p class={css(styles.note)}>
        Proyek terbuka:{" "}
        <a href="https://github.com/dhantyo/hukum-bersih">
          kode dan data di GitHub
        </a>{" "}
        · data CC0 · kode AGPL-3.0 ·{" "}
        <a href={slashed(Router.paths.tentang)}>tentang proyek ini</a>
      </p>
    </div>
  </footer>
);
