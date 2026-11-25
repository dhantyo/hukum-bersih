import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@ui-sdk/solid/drawer";
import { usePreference } from "@ui-sdk/solid/preferences";
import { Toggle, ToggleIcon } from "@ui-sdk/solid/toggle";
import { createSignal, For, onSettled, Show, useContext } from "solid-js";

import { ReaderViewContext } from "../lib/reader-view.ts";
import { panel as panelPreference } from "../lib/reading-preferences.ts";
import type { ReaderText } from "../server/records/reader-text.ts";
import { css } from "../styles/css.ts";
import { linkStyles } from "../styles/link.ts";
import { color, media, shadow, size, space } from "../styles/tokens.stylex.ts";

const HIDDEN = ':is([data-panel="hidden"])';
const TABLET_QUERY = "(max-width: 960px)";

const styles = stylex.create({
  crumbs: {
    margin: `${space.s5} 0 0`,
    gap: `0 ${space.s2}`,
    color: color.textMuted,
    display: "flex",
    flexWrap: "wrap",
    fontSize: size.sm,
  },
  crumb: {
    marginBlock: { default: null, [media.touch]: `calc(-1 * ${space.s3})` },
    paddingBlock: { default: null, [media.touch]: space.s3 },
    color: color.textMuted,
    display: { default: null, [media.touch]: "inline-block" },
  },
  head: {
    marginBlock: `${space.s4} ${space.s6}`,
    maxInlineSize: "52rem",
  },
  eyebrow: { margin: 0, color: color.textMuted, fontSize: size.sm },
  title: {
    fontSize: { default: size.xxl, [media.phone]: size.xl },
    marginBlockEnd: space.s2,
  },
  subtitle: {
    margin: 0,
    color: color.textMuted,
    fontSize: { default: size.lg, [media.phone]: size.base },
  },
  doc: {
    gap: { default: space.s7, [media.tablet]: 0 },
    alignItems: "start",
    display: "grid",
    gridTemplateColumns: {
      default: `${size.panel} minmax(0, 1fr)`,
      [stylex.when.ancestor(HIDDEN)]: `${size.tap} minmax(0, 1fr)`,
      [media.tablet]: "minmax(0, 1fr)",
    },
  },
  rail: {
    gridColumn: 1,
    gridRow: 1,
    display: {
      default: "none",
      [stylex.when.ancestor(HIDDEN)]: "block",
      [media.tablet]: "none",
    },
    position: "sticky",
    top: space.s4,
  },
  railButton: {
    padding: 0,
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    placeItems: "center",
    backgroundColor: "transparent",
    blockSize: size.tap,
    color: {
      default: color.text,
      ":hover": color.link,
    },
    cursor: "pointer",
    display: "grid",
    inlineSize: size.tap,
  },
  panel: {
    gridColumn: 1,
    gridRow: 1,
    display: {
      default: null,
      [stylex.when.ancestor(HIDDEN)]: "none",
      [media.tabletScripted]: "none",
    },
    fontSize: size.sm,
    maxBlockSize: {
      default: `calc(100vh - ${space.s6})`,
      [media.tablet]: "none",
    },
    paddingInlineEnd: space.s2,
    position: { default: "sticky", [media.tablet]: "static" },
    overflowY: { default: "auto", [media.tablet]: "visible" },
    top: space.s4,
  },
  panelBar: {
    gap: space.s2,
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    marginBlockEnd: space.s3,
  },
  hideButton: {
    borderRadius: size.radius,
    borderWidth: 0,
    gap: space.s1,
    paddingBlock: space.s1,
    paddingInline: 0,
    alignItems: "center",
    backgroundColor: "transparent",
    color: {
      default: color.textMuted,
      ":hover": color.link,
    },
    cursor: "pointer",
    display: { default: "inline-flex", [media.tablet]: "none" },
    fontFamily: "inherit",
    fontSize: size.xs,
    minBlockSize: space.s6,
  },
  main: {
    gridColumn: { default: 2, [media.tablet]: 1 },
    gridRow: 1,
    inlineSize: {
      default: null,
      [stylex.when.ancestor(HIDDEN)]: `min(100%, ${size.measure})`,
      [media.tablet]: "auto",
    },
    justifySelf: {
      default: null,
      [stylex.when.ancestor(HIDDEN)]: "center",
      [media.tablet]: "stretch",
    },
    minInlineSize: 0,
  },
  tab: {
    padding: 0,
    borderColor: color.lineStrong,
    borderStyle: "solid",
    borderWidth: 1,
    placeItems: "center",
    backgroundColor: color.surface,
    blockSize: space.s8,
    borderEndEndRadius: size.radiusMd,
    borderInlineStartWidth: 0,
    borderStartEndRadius: size.radiusMd,
    boxShadow: shadow.sm,
    color: {
      default: color.textMuted,
      ":focus-visible": color.link,
      ":hover": color.link,
    },
    cursor: "pointer",
    display: "grid",
    inlineSize: size.tab,
    insetBlockStart: "50%",
    insetInlineStart: 0,
    position: "fixed",
    transform: "translateY(-50%)",
    visibility: { default: null, ":is([data-open])": "hidden" },
    zIndex: 20,
    "::before": {
      inset: `0 calc(${size.tab} - ${size.tap}) 0 0`,
      content: '""',
      position: "absolute",
    },
  },
  backdrop: { inset: 0, backgroundColor: color.scrim, position: "fixed" },
  sheet: {
    padding: space.s4,
    backgroundColor: color.background,
    blockSize: "100dvh",
    borderInlineEndColor: color.line,
    borderInlineEndStyle: "solid",
    borderInlineEndWidth: 1,
    boxShadow: shadow.pop,
    boxSizing: "border-box",
    color: color.text,
    fontFamily: "inherit",
    fontSize: size.sm,
    inlineSize: `min(${size.drawer}, calc(100vw - ${space.s7}))`,
    overflowY: "auto",
  },
  sheetBar: {
    gap: space.s2,
    paddingBlock: space.s2,
    alignItems: "center",
    backgroundColor: color.background,
    display: "flex",
    insetBlockStart: `calc(-1 * ${space.s4})`,
    justifyContent: "space-between",
    marginBlockEnd: space.s3,
    position: "sticky",
    zIndex: 1,
  },
  sheetTitle: {
    margin: 0,
    fontSize: size.base,
    fontWeight: 600,
  },
  closeButton: {
    padding: 0,
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    placeItems: "center",
    backgroundColor: "transparent",
    blockSize: size.tap,
    color: color.text,
    cursor: "pointer",
    display: "grid",
    fontSize: size.lg,
    inlineSize: size.tap,
  },
});

export interface Crumb {
  href?: string;
  label: string;
}

const Chevron = (props: { direction: "left" | "right" }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path
      d={
        props.direction === "left"
          ? "M9.5 3.5 5 8l4.5 4.5"
          : "M6.5 3.5 11 8l-4.5 4.5"
      }
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

export const Breadcrumbs = (props: { crumbs: Crumb[] }) => (
  <nav class={css(styles.crumbs)} aria-label="Lokasi">
    <For each={props.crumbs}>
      {(crumb, index) => (
        <>
          {index() > 0 && <span aria-hidden="true">›</span>}
          {crumb.href === undefined ? (
            <span>{crumb.label}</span>
          ) : (
            <a class={css(linkStyles.base, styles.crumb)} href={crumb.href}>
              {crumb.label}
            </a>
          )}
        </>
      )}
    </For>
  </nav>
);

const setShown = (next: boolean) => {
  panelPreference.set(next ? "shown" : "hidden");
};

const SidePanel = (props: { label: string; children: JSX.Element }) => {
  const state = usePreference(panelPreference);
  const shown = () => state().value === "shown";

  return (
    <>
      <div class={css(styles.rail)}>
        <Toggle
          class={css(styles.railButton)}
          aria-label={`Panel samping (${props.label.toLowerCase()})`}
          pressed={shown()}
          onPressedChange={setShown}
        >
          <ToggleIcon>
            <Chevron direction="right" />
          </ToggleIcon>
        </Toggle>
      </div>
      <aside class={css(styles.panel)} aria-label={props.label}>
        <div class={css(styles.panelBar)}>
          <Toggle
            class={css(styles.hideButton)}
            pressed={shown()}
            onPressedChange={setShown}
          >
            <ToggleIcon>
              <Chevron direction="left" />
            </ToggleIcon>
            Sembunyikan
          </Toggle>
        </div>
        {props.children}
      </aside>
    </>
  );
};

const PanelDrawer = (props: { label: string; children: JSX.Element }) => {
  const [open, setOpen] = createSignal(false);

  return (
    <Drawer
      side="left"
      open={open()}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <DrawerTrigger
        class={css(styles.tab)}
        aria-label={`Buka ${props.label.toLowerCase()}`}
      >
        <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">
          <path
            d="M3 3.5 7.5 8 3 12.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </DrawerTrigger>
      <DrawerBackdrop class={css(styles.backdrop)} />
      <DrawerContent
        class={css(styles.sheet)}
        onClick={(event: MouseEvent) => {
          if (
            event.target instanceof Element &&
            event.target.closest("a[href]") !== null
          ) {
            setOpen(false);
          }
        }}
      >
        <div class={css(styles.sheetBar)}>
          <DrawerTitle class={css(styles.sheetTitle)}>
            {props.label}
          </DrawerTitle>
          <DrawerClose class={css(styles.closeButton)} aria-label="Tutup">
            <span aria-hidden="true">×</span>
          </DrawerClose>
        </div>
        {props.children}
      </DrawerContent>
    </Drawer>
  );
};

const useTablet = () => {
  const [tablet, setTablet] = createSignal(false);

  onSettled(() => {
    const query = matchMedia(TABLET_QUERY);

    const update = () => {
      setTablet(query.matches);
    };

    update();
    query.addEventListener("change", update);

    return () => {
      query.removeEventListener("change", update);
    };
  });

  return tablet;
};

/**
 * A document page: breadcrumbs, the title block, then a side panel beside the text
 * (DESIGN.md "Spacing and layout"). Without JavaScript the panel is plain content beside
 * or above the text.
 */
export const DocLayout = (props: {
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  subtitle?: string;
  headMeta: JSX.Element;
  /** The text on this page: the "Aa" settings in the header then offer its parts. */
  text?: ReaderText;
  panelLabel: string;
  panel: JSX.Element;
  children: JSX.Element;
}) => {
  const [, setReaderText] = useContext(ReaderViewContext);
  const tablet = useTablet();

  onSettled(() => {
    setReaderText(props.text);

    return () => {
      setReaderText(undefined);
    };
  });

  return (
    <main>
      <Breadcrumbs crumbs={props.crumbs} />
      <header class={css(styles.head)}>
        <p class={css(styles.eyebrow)}>{props.eyebrow}</p>
        <h1 class={css(styles.title)}>{props.title}</h1>
        <Show when={props.subtitle}>
          {(subtitle) => <p class={css(styles.subtitle)}>{subtitle()}</p>}
        </Show>
        {props.headMeta}
      </header>
      <div class={css(styles.doc)}>
        <Show
          when={tablet()}
          fallback={
            <SidePanel label={props.panelLabel}>{props.panel}</SidePanel>
          }
        >
          <PanelDrawer label={props.panelLabel}>{props.panel}</PanelDrawer>
        </Show>
        <div class={css(styles.main)}>{props.children}</div>
      </div>
    </main>
  );
};
