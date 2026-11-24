import { useHead } from "@solidjs/web";

export const usePageTitle = (title: () => string) => {
  useHead(() => ({
    tag: "title",
    props: { children: `${title()} · Hukum Bersih` },
  }));
};

export const usePageDescription = (description: string) => {
  useHead({
    tag: "meta",
    props: { name: "description", content: description },
  });
};

export const useNoindex = () => {
  useHead({ tag: "meta", props: { name: "robots", content: "noindex" } });
};
