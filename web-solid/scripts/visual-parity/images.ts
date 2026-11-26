import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const GAP = 16;
const PAD = [128, 128, 128, 255] as const;
const PIXEL_THRESHOLD = 0.1;
const CHANNELS = 4;
const PERCENT = 100;

export interface Comparison {
  diff: Buffer;
  side: Buffer;
  mismatchPct: number;
  astroSize: [number, number];
  solidSize: [number, number];
}

const blank = (width: number, height: number) => {
  const image = new PNG({ width, height });

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    image.data.set(PAD, pixel * CHANNELS);
  }

  return image;
};

const padTo = (source: PNG, width: number, height: number) => {
  const out = blank(width, height);
  PNG.bitblt(source, out, 0, 0, source.width, source.height, 0, 0);

  return out;
};

export const compare = (astroPng: Buffer, solidPng: Buffer) => {
  const astro = PNG.sync.read(astroPng);
  const solid = PNG.sync.read(solidPng);
  const width = Math.max(astro.width, solid.width);
  const height = Math.max(astro.height, solid.height);
  const diff = new PNG({ width, height });

  const mismatched = pixelmatch(
    padTo(astro, width, height).data,
    padTo(solid, width, height).data,
    diff.data,
    width,
    height,
    { threshold: PIXEL_THRESHOLD }
  );

  const side = blank(astro.width + GAP + solid.width, height);
  PNG.bitblt(astro, side, 0, 0, astro.width, astro.height, 0, 0);
  PNG.bitblt(
    solid,
    side,
    0,
    0,
    solid.width,
    solid.height,
    astro.width + GAP,
    0
  );

  return {
    diff: PNG.sync.write(diff),
    side: PNG.sync.write(side),
    mismatchPct: (mismatched / (width * height)) * PERCENT,
    astroSize: [astro.width, astro.height],
    solidSize: [solid.width, solid.height],
  };
};
