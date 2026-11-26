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
import {
  createResizableController,
  Resizable,
  ResizableHandle,
  ResizablePanel,
} from "@ui-sdk/solid/resizable";
import { Toggle, ToggleIcon } from "@ui-sdk/solid/toggle";
import {
  createEffect,
  createSignal,
  For,
  onSettled,
  Show,
  useContext,
} from "solid-js";

import {
  PANEL_REM,
  readSavedWidth,
  saveWidth,
  WIDTH_SCRIPT,
} from "../lib/panel-size.ts";
import { ReaderViewContext } from "../lib/reader-view.ts";
import {
  comparePanel,
  panel as panelPreference,
} from "../lib/reading-preferences.ts";
import type { ReaderText } from "../server/records/reader-text.ts";
import { css } from "../styles/css.ts";
import { headerOffset } from "../styles/header-offset.stylex.ts";
import { linkStyles } from "../styles/link.ts";
import { color, media, shadow, size, space } from "../styles/tokens.stylex.ts";

const MOTION = "@media (prefers-reduced-motion: no-preference)";
const HIDDEN = ':is([data-panel="hidden"])';
const TABLET_QUERY = "(max-width: 960px)";
const FOLD = "@media (min-width: 961px) and (max-width: 1499px)";
const FOLD_QUERY = FOLD.replace("@media ", "");
const WIDE = "@media (min-width: 961px)";

const COMPARING = ":has([data-cmp-bar])";
const FOLDED = ':has([data-cmp-bar]):not([data-cmp-panel="open"])';
const UNFOLDED = ':has([data-cmp-bar])[data-cmp-panel="open"]';

const PANEL_ID = "doc-panel";
const COLUMNS = ':has([data-slot="scroll-area"])';
const HIDDEN_TEXT = `${HIDDEN}:not(${COLUMNS})`;
const HOVERED = ":is([data-hovering])";
const DRAGGED = ":is([data-dragging])";

const rem = (value: number) => `${value}rem` as const;

const styles = stylex.create({
  crumbs: {
    margin: `${space.s5} 0 0`,
    gap: `0 ${space.s2}`,
    color: color.textMuted,
    display: "flex",
    flexWrap: "wrap",
    fontSize: size.sm,
  },
  crumbsFlush: { marginBlockStart: 0 },
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
  doc: { display: "block" },
  group: {
    alignItems: "flex-start",
    display: { default: null, [media.tablet]: "block !important" },
  },
  panel: {
    transition: { [MOTION]: "max-width 0.24s ease-out", default: null },
    display: { default: null, [media.tabletScripted]: "none" },
    fontSize: size.sm,
    maxBlockSize: {
      default: `calc(100vh - ${space.s6} - ${headerOffset.shown})`,
      [media.tablet]: "none",
    },
    maxInlineSize: {
      [FOLD]: {
        default: null,
        [stylex.when.ancestor(FOLDED)]: size.tap,
        [stylex.when.ancestor(UNFOLDED)]: "none",
      },
      default: null,
      [stylex.when.ancestor(HIDDEN)]: size.tap,
      [media.tablet]: "none",
    },
    position: { default: "sticky", [media.tablet]: "static" },
    overflowY: { default: "auto", [media.tablet]: "visible" },
    top: `calc(${space.s4} + ${headerOffset.shown})`,
  },
  handle: {
    alignSelf: "stretch",
    display: { default: "block", [media.tablet]: "none" },
    inlineSize: space.s5,
    outlineStyle: "none",
    position: "relative",
    "::after": {
      insetBlock: 0,
      backgroundColor: {
        [DRAGGED]: color.link,
        [HOVERED]: color.lineStrong,
        default: "transparent",
        ":focus-visible": color.link,
      },
      content: '""',
      inlineSize: { [DRAGGED]: 2, default: 1, ":focus-visible": 3 },
      insetInlineStart: "50%",
      position: "absolute",
      transform: "translateX(-50%)",
    },
  },
  rail: {
    display: {
      [FOLD]: {
        default: null,
        [stylex.when.ancestor(FOLDED)]: "block",
        [stylex.when.ancestor(UNFOLDED)]: "none",
      },
      default: "none",
      [stylex.when.ancestor(HIDDEN)]: "block",
      [media.tablet]: "none",
    },
  },
  railButton: {
    padding: 0,
    borderRadius: size.radius,
    borderWidth: 0,
    placeItems: "center",
    backgroundColor: "transparent",
    blockSize: size.tap,
    color: {
      default: color.textMuted,
      ":hover": color.link,
    },
    cursor: "pointer",
    display: "grid",
    inlineSize: size.tap,
    outlineColor: color.link,
    outlineOffset: { default: null, ":focus-visible": -2 },
    outlineStyle: { default: null, ":focus-visible": "solid" },
    outlineWidth: { default: null, ":focus-visible": 2 },
  },
  content: {
    display: {
      [FOLD]: {
        default: null,
        [stylex.when.ancestor(FOLDED)]: "none",
        [stylex.when.ancestor(UNFOLDED)]: "block",
      },
      default: "block",
      [stylex.when.ancestor(HIDDEN)]: "none",
      [media.tablet]: "block",
    },
    paddingBlockEnd: space.s6,
  },
  panelBar: { marginBlockEnd: space.s4 },
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
    outlineColor: color.link,
    outlineOffset: { default: null, ":focus-visible": 2 },
    outlineStyle: { default: null, ":focus-visible": "solid" },
    outlineWidth: { default: null, ":focus-visible": 2 },
  },
  text: {
    minInlineSize: 0,
    paddingInlineStart: {
      default: space.s5,
      [stylex.when.ancestor(COLUMNS)]: 0,
      [media.tablet]: 0,
    },
  },
  textBody: {
    marginInline: {
      [WIDE]: { default: null, [stylex.when.ancestor(COMPARING)]: 0 },
      default: null,
      [stylex.when.ancestor(HIDDEN_TEXT)]: "auto",
      [media.tablet]: 0,
    },
    inlineSize: {
      [WIDE]: { default: null, [stylex.when.ancestor(COMPARING)]: "auto" },
      default: null,
      [stylex.when.ancestor(HIDDEN_TEXT)]: `min(100%, ${size.measure})`,
      [media.tablet]: "auto",
    },
  },
  tab: {
    padding: 0,
    borderColor: color.line,
    borderStyle: "solid",
    borderWidth: 1,
    placeItems: "center",
    backgroundColor: color.background,
    blockSize: space.s8,
    borderEndEndRadius: size.radiusMd,
    borderInlineStartWidth: 0,
    borderStartEndRadius: size.radiusMd,
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
    paddingBlock: space.s4,
    paddingInline: space.s5,
    backgroundColor: color.background,
    blockSize: "100dvh",
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
    borderRadius: size.radius,
    borderWidth: 0,
    placeItems: "center",
    backgroundColor: "transparent",
    blockSize: size.tap,
    color: {
      default: color.textMuted,
      ":hover": color.link,
    },
    cursor: "pointer",
    display: "grid",
    fontSize: size.lg,
    inlineSize: size.tap,
    marginInlineEnd: `calc(-1 * ${space.s3})`,
    outlineColor: color.link,
    outlineOffset: { default: null, ":focus-visible": -2 },
    outlineStyle: { default: null, ":focus-visible": "solid" },
    outlineWidth: { default: null, ":focus-visible": 2 },
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

export const Breadcrumbs = (props: { crumbs: Crumb[]; flush?: boolean }) => (
  <nav
    class={css(styles.crumbs, props.flush === true && styles.crumbsFlush)}
    aria-label="Lokasi"
  >
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

const useMedia = (query: string) => {
  const [matches, setMatches] = createSignal(false);

  onSettled(() => {
    const list = matchMedia(query);

    const update = () => {
      setMatches(list.matches);
    };

    update();
    list.addEventListener("change", update);

    return () => {
      list.removeEventListener("change", update);
    };
  });

  return matches;
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

const useFoldedPanel = (props: { comparing: boolean; tablet: boolean }) => {
  const state = usePreference(panelPreference);
  const compared = usePreference(comparePanel);
  const narrow = useMedia(FOLD_QUERY);
  const controller = createResizableController();
  const folded = () => props.comparing && narrow();

  const collapsed = () =>
    folded() ? compared().value !== "open" : state().value === "hidden";

  const setCollapsed = (next: boolean) => {
    if (folded()) {
      comparePanel.set(next ? "closed" : "open");
    } else {
      panelPreference.set(next ? "hidden" : "shown");
    }
  };

  const settle = (want: { collapsed: boolean; tablet: boolean }) => {
    if (want.tablet || controller.isCollapsed(PANEL_ID) === want.collapsed) {
      return;
    }

    if (want.collapsed) {
      controller.collapse(PANEL_ID);
    } else {
      controller.expand(PANEL_ID);
    }
  };

  createEffect(
    () => ({ collapsed: collapsed(), tablet: props.tablet }),
    settle
  );

  onSettled(() => {
    requestAnimationFrame(() => {
      settle({ collapsed: collapsed(), tablet: props.tablet });
    });
  });

  let groupCollapsed = false;

  const follow = () => {
    const next = controller.isCollapsed(PANEL_ID);

    if (next !== groupCollapsed) {
      groupCollapsed = next;

      if (next !== collapsed()) {
        setCollapsed(next);
      }
    }
  };

  const remember = () => {
    const width = document
      .querySelector(`#${PANEL_ID}`)
      ?.getBoundingClientRect().width;

    if (width !== undefined && !controller.isCollapsed(PANEL_ID)) {
      saveWidth(
        width /
          Number(
            getComputedStyle(document.documentElement).fontSize.slice(0, -2)
          )
      );
    }
  };

  return { collapsed, controller, follow, remember, setCollapsed };
};

const PanelGroup = (props: {
  label: string;
  comparing: boolean;
  tablet: boolean;
  panel: JSX.Element;
  children: JSX.Element;
}) => {
  const fold = useFoldedPanel(props);
  const startWidth = rem(readSavedWidth() ?? PANEL_REM.default);

  const setShown = (next: boolean) => {
    fold.setCollapsed(!next);
  };

  return (
    <Resizable
      class={css(styles.group)}
      controller={fold.controller}
      onLayoutChange={fold.follow}
      onLayoutCommit={fold.remember}
    >
      <ResizablePanel
        id={PANEL_ID}
        class={css(styles.panel)}
        defaultSize={startWidth}
        minSize={rem(PANEL_REM.min)}
        maxSize={rem(PANEL_REM.max)}
        collapsible
        collapsedSize={rem(PANEL_REM.collapsed)}
      >
        <Show when={!props.tablet}>
          <div class={css(styles.rail)}>
            <Toggle
              class={css(styles.railButton)}
              aria-label={`Panel samping (${props.label.toLowerCase()})`}
              pressed={!fold.collapsed()}
              onPressedChange={setShown}
            >
              <ToggleIcon>
                <Chevron direction="right" />
              </ToggleIcon>
            </Toggle>
          </div>
          <aside class={css(styles.content)} aria-label={props.label}>
            <div class={css(styles.panelBar)}>
              <Toggle
                class={css(styles.hideButton)}
                pressed={!fold.collapsed()}
                onPressedChange={setShown}
              >
                <ToggleIcon>
                  <Chevron direction="left" />
                </ToggleIcon>
                Sembunyikan
              </Toggle>
            </div>
            {props.panel}
          </aside>
        </Show>
      </ResizablePanel>
      <ResizableHandle
        class={css(styles.handle)}
        aria-label="Ubah lebar panel samping"
      />
      <ResizablePanel class={css(styles.text)} minSize={rem(20)}>
        <div class={css(styles.textBody)}>{props.children}</div>
      </ResizablePanel>
    </Resizable>
  );
};

const useTablet = () => useMedia(TABLET_QUERY);

/**
 * A document page: breadcrumbs, the title block, then a side panel beside the text
 * (DESIGN.md "Spacing and layout"). Without JavaScript the panel is plain content beside
 * or above the text.
 */
export const DocLayout = (props: {
  crumbs: Crumb[];
  /** No space above the breadcrumbs, as on Astro pages that carry no search metadata. */
  flushCrumbs?: boolean;
  eyebrow: string;
  title: string;
  subtitle?: string;
  headMeta: JSX.Element;
  /** The text on this page: the "Aa" settings in the header then offer its parts. */
  text?: ReaderText;
  panelLabel: string;
  panel: JSX.Element;
  /** The page holds a comparison: the text widens and the panel folds away below 1500px. */
  comparing?: boolean;
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
      <Breadcrumbs crumbs={props.crumbs} flush={props.flushCrumbs} />
      <header class={css(styles.head)}>
        <p class={css(styles.eyebrow)}>{props.eyebrow}</p>
        <h1 class={css(styles.title)}>{props.title}</h1>
        <Show when={props.subtitle}>
          {(subtitle) => <p class={css(styles.subtitle)}>{subtitle()}</p>}
        </Show>
        {props.headMeta}
      </header>
      <div class={css(styles.doc)}>
        <script>{WIDTH_SCRIPT}</script>
        <Show when={tablet()}>
          <PanelDrawer label={props.panelLabel}>{props.panel}</PanelDrawer>
        </Show>
        <PanelGroup
          label={props.panelLabel}
          comparing={props.comparing === true}
          tablet={tablet()}
          panel={props.panel}
        >
          {props.children}
        </PanelGroup>
      </div>
    </main>
  );
};
