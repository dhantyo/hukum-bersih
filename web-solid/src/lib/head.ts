import { useHead } from "@solidjs/web";

export const usePageTitle = (title: () => string) => {
  useHead(() => ({
    tag: "title",
    props: { children: `${title()} | Hukum Bersih` },
  }));
};

export const useNoindex = () => {
  useHead({ tag: "meta", props: { name: "robots", content: "noindex" } });
};
