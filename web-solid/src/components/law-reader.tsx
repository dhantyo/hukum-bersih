import { isPresent } from "../lib/text.ts";
import type { Amendment, ReaderLaw } from "../server/records/law.ts";
import { readerClass } from "../styles/reading.ts";
import { LawText } from "./law-text.tsx";

export const LawReader = (props: {
  law: ReaderLaw;
  amendment?: Amendment;
  comparisonRequested?: boolean;
}) => (
  <main class={readerClass}>
    <header>
      <p>{props.law.title}</p>
      <h1>
        {isPresent(props.law.subject) ? props.law.subject : props.law.title}
      </h1>
      {props.law.hasAmendments && (
        <p>
          <a href="./perubahan/">Riwayat perubahan</a>
          {" · "}
          {props.comparisonRequested === true ? (
            <a href="./">Tutup perbandingan</a>
          ) : (
            <a href="?bandingkan">Bandingkan</a>
          )}
        </p>
      )}
      {props.amendment && <p>Perubahan oleh {props.amendment.label}</p>}
      {props.comparisonRequested === true && !props.amendment && (
        <p>Perbandingan versi ini belum tersedia.</p>
      )}
      <ul aria-label="Sumber">
        <li>
          <a href={props.law.source}>Halaman resmi</a>
        </li>
        {props.law.pdf !== null && (
          <li>
            <a href={props.law.pdf}>Unduh PDF</a>
          </li>
        )}
        {isPresent(props.law.archive) && (
          <li>
            <a href={props.law.archive}>Salinan arsip</a>
          </li>
        )}
      </ul>
    </header>
    {props.law.text ? (
      <LawText text={props.law.text} amendment={props.amendment} />
    ) : (
      <p>Teks belum tersedia.</p>
    )}
  </main>
);
