import * as stylex from "@stylexjs/stylex";
import { Input, InputClear, InputGroup } from "@ui-sdk/solid/input";

import { prefetchSearch } from "../lib/search-data.ts";
import { PLAIN_SEARCH_PATH } from "../lib/search-form.ts";
import { css } from "../styles/css.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import { accessibility } from "../styles/visually-hidden.ts";

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

/**
 * The big search field. The page that holds it searches as you type and handles the submit. A
 * form with no handler submits to `/cari/hasil/`, which the server answers with the results.
 */
export const SearchBox = (props: {
  query: string;
  onQuery?: (text: string) => void;
  onSubmit?: () => void;
}) => (
  <search aria-label="Cari teks hukum">
    <form
      method="get"
      action={PLAIN_SEARCH_PATH}
      onSubmit={(event) => {
        if (props.onSubmit !== undefined) {
          event.preventDefault();
          props.onSubmit();
        }
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
          value={props.query}
          maxlength={200}
          autocomplete="off"
          autofocus
          placeholder="Nama singkat, nomor (4/2009), judul, atau kata dalam pasal"
          onFocus={prefetchSearch}
          onValueChange={(value) => {
            props.onQuery?.(value);
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
