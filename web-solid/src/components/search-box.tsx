import { useNavigate } from "@solidjs/router";
import * as stylex from "@stylexjs/stylex";
import { Input, InputClear, InputGroup } from "@ui-sdk/solid/input";
import { createEffect, createSignal, onCleanup } from "solid-js";

import { slashed } from "../lib/paths.ts";
import { Router } from "../router.tsx";
import { css } from "../styles/css.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import { accessibility } from "../styles/visually-hidden.ts";

const TYPING_PAUSE_MS = 200;
const BOX_WIDTH = "44rem";

const styles = stylex.create({
  group: {
    maxInlineSize: BOX_WIDTH,
    position: "relative",
  },
  input: {
    font: "inherit",
    borderColor: color.lineStrong,
    borderRadius: size.radiusMd,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.s3,
    appearance: "none",
    backgroundColor: color.background,
    boxSizing: "border-box",
    color: color.text,
    fontSize: size.lg,
    inlineSize: "100%",
    outlineColor: color.link,
    outlineOffset: { default: null, ":focus-visible": 1 },
    outlineStyle: { default: null, ":focus-visible": "solid" },
    outlineWidth: { default: null, ":focus-visible": 2 },
    paddingInlineEnd: size.tap,
    paddingInlineStart: space.s4,
    "::-webkit-search-cancel-button": { display: "none" },
    "::placeholder": { color: color.textMuted },
  },
  clear: {
    padding: 0,
    borderColor: "transparent",
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 0,
    insetBlock: 0,
    alignItems: "center",
    backgroundColor: "transparent",
    color: color.link,
    cursor: "pointer",
    display: "flex",
    inlineSize: size.tap,
    insetInlineEnd: 0,
    justifyContent: "center",
    outlineColor: color.link,
    outlineOffset: { default: null, ":focus-visible": -2 },
    outlineStyle: { default: null, ":focus-visible": "solid" },
    outlineWidth: { default: null, ":focus-visible": 3 },
    position: "absolute",
  },
  icon: {
    blockSize: "1.25rem",
    inlineSize: "1.25rem",
  },
});

const searchUrl = (text: string) =>
  text === ""
    ? slashed(Router.paths.cari)
    : `${slashed(Router.paths.cari)}?q=${encodeURIComponent(text)}`;

/**
 * The big search field. Without JavaScript it is a GET form to `/cari/`. With it, the page
 * searches as you type: the address changes in place and the results below follow. A plain form
 * beats a combobox here, because the answer is a page of grouped results, not one value picked
 * from a list.
 */
export const SearchBox = (props: { query: string }) => {
  const navigate = useNavigate();
  const [typed, setTyped] = createSignal<string | undefined>(undefined);
  let pending: ReturnType<typeof setTimeout> | undefined;
  let sent: string | undefined;

  const text = () => typed() ?? props.query;

  const go = (next: string) => {
    clearTimeout(pending);
    sent = next;
    navigate(searchUrl(next), { replace: true });
  };

  onCleanup(() => {
    clearTimeout(pending);
  });

  createEffect(
    () => props.query,
    (query) => {
      if (query !== sent) {
        sent = query;
        setTyped(undefined);
      }
    }
  );

  return (
    <search aria-label="Cari teks hukum">
      <form
        method="get"
        action={slashed(Router.paths.cari)}
        onSubmit={(event) => {
          event.preventDefault();
          go(text().trim());
        }}
      >
        <label class={css(accessibility.visuallyHidden)} for="search-query">
          Cari
        </label>
        <InputGroup class={css(styles.group)}>
          <Input
            class={css(styles.input)}
            id="search-query"
            name="q"
            type="search"
            value={text()}
            maxlength={200}
            autocomplete="off"
            autofocus
            placeholder="Nama singkat, nomor (4/2009), judul, atau kata dalam pasal"
            onValueChange={(value, details) => {
              setTyped(value);
              clearTimeout(pending);

              if (details.reason === "clear-press") {
                go("");
              } else {
                pending = setTimeout(() => {
                  go(value.trim());
                }, TYPING_PAUSE_MS);
              }
            }}
          />
          <InputClear class={css(styles.clear)} aria-label="Hapus pencarian">
            <svg
              class={css(styles.icon)}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </InputClear>
        </InputGroup>
      </form>
    </search>
  );
};
