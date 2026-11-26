import { isServer } from "@solidjs/web";
import { createSignal, onSettled } from "solid-js";
import type * as v from "valibot";

import type { compareSearch } from "./schemas.ts";

type CompareSearch = v.InferOutput<typeof compareSearch>;

let hydrated = isServer;

const renderedWithComparison = () =>
  !isServer && document.querySelector("[data-cmp-bar]") !== null;

export const useHydratedSearch = (search: () => CompareSearch) => {
  const [ready, setReady] = createSignal(hydrated || renderedWithComparison());

  onSettled(() => {
    hydrated = true;
    setReady(true);
  });

  return () => (ready() ? search() : { ...search(), v: undefined });
};
