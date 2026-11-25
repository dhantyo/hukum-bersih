import type { RouteProps } from "@solidjs/router";
import { useHead } from "@solidjs/web";
import { createMemo, onSettled, Show } from "solid-js";

import { usePageTitle } from "../lib/head.ts";
import { lawUrl } from "../lib/paths.ts";
import { perubahanQuery } from "../lib/queries.ts";
import { isPresent } from "../lib/text.ts";
import { linkClass } from "../styles/link.ts";
import NotFound from "./not-found.tsx";

const OLD_ANCHOR = /^(?<law>[a-z]+_[0-9a-z]+_\d{4})(?:-pasal-(?<pasal>.+))?$/iu;

const forwardedUrl = (target: string, hash: string) => {
  const found = OLD_ANCHOR.exec(decodeURIComponent(hash.slice(1)))?.groups;
  const search = found ? `?bandingkan=${found.law}` : "?bandingkan";

  const anchor = isPresent(found?.pasal)
    ? `#pasal-${found.pasal.toLowerCase().replaceAll(/[^0-9a-z]+/gu, "")}`
    : "";

  return `${target}${search}${anchor}`;
};

const PerubahanPage = (props: RouteProps<"/uu/:nomor/:tahun/perubahan">) => {
  const forward = createMemo(
    async () => await perubahanQuery(lawUrl(props.params))
  );

  return (
    <Show when={forward()} fallback={<NotFound />} keyed>
      {(record) => {
        usePageTitle(() => "Perubahan");
        useHead([
          { tag: "meta", props: { name: "robots", content: "noindex" } },
          { tag: "link", props: { rel: "canonical", href: record.target } },
          {
            tag: "meta",
            props: {
              "http-equiv": "refresh",
              content: `0; url=${record.target}?bandingkan`,
            },
          },
        ]);
        onSettled(() => {
          location.replace(forwardedUrl(record.target, location.hash));
        });

        return (
          <main>
            <p>
              Halaman ini sudah pindah.{" "}
              <a class={linkClass} href={`${record.target}?bandingkan`}>
                Buka perbandingan versi
              </a>
              .
            </p>
          </main>
        );
      }}
    </Show>
  );
};

export default PerubahanPage;
