import { createContext, createSignal } from "solid-js";

import type { ReaderText } from "../server/records/reader-text.ts";

/** The text of the page on screen, if it has one: the header's "Aa" settings offer the parts it has. */
export const createReaderView = () => createSignal<ReaderText | undefined>();

export const ReaderViewContext =
  createContext<ReturnType<typeof createReaderView>>();
