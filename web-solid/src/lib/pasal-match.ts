import { pasalKey } from "./display.ts";

const LEADING_PASAL = /^\s*pasal\s*/iu;

/** Whether a pasal number ("27", "27A") starts with what was typed ("27", "Pasal 27", "27 a"). */
export const pasalStartsWith = (num: string, typed: string) =>
  pasalKey(num).startsWith(pasalKey(typed.replace(LEADING_PASAL, "")));
