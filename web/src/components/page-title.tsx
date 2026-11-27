import { Title } from "@solidjs/meta";

const SITE_NAME = "Hukum Rapih";

export const PageTitle = (props: { children: string }) => (
  <Title>{`${props.children} · ${SITE_NAME}`}</Title>
);
