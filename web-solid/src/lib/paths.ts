export const slashed = (path: { toString: () => string }) => {
  const href = path.toString();

  return href.endsWith("/") ? href : `${href}/`;
};

export const lawUrl = (params: { nomor: string; tahun: string }) =>
  `/uu/${params.nomor}/${params.tahun}/`;

export const draftChangesUrl = (
  draft: string,
  changes: { from: string; to: string }
) => `/ruu/${draft}/beda/${changes.from}...${changes.to}/`;
