import { useNavigate } from "@solidjs/router";
import * as v from "valibot";

import { searchText } from "./schemas.ts";

const SEARCH_PATH = "/cari/";
export const PLAIN_SEARCH_PATH = "/cari/hasil/";

export const searchUrl = (text: string) =>
  text === "" ? SEARCH_PATH : `${SEARCH_PATH}?q=${encodeURIComponent(text)}`;

export const plainSearchUrl = (text: string) =>
  `${PLAIN_SEARCH_PATH}?q=${encodeURIComponent(text)}`;

export const useSearchSubmit = () => {
  const navigate = useNavigate();

  return (event: SubmitEvent & { currentTarget: HTMLFormElement }) => {
    event.preventDefault();
    navigate(
      searchUrl(v.parse(searchText, new FormData(event.currentTarget).get("q")))
    );
  };
};
