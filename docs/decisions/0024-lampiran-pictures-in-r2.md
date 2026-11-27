# 0024 Pictures in a Lampiran are kept as images in R2

Date: 2026-11-28 · Decided by: the operator; change by Claude

## What

Maps and other pictures in a Lampiran are kept as images. Today only their text survives (a
map's legend), or nothing.

- The parser flags each Lampiran page with a picture or drawing. The agent routine (decision
  0022) decides whether it is worth keeping and what area to cut.
- Actions cuts each image as WebP at about 200 dpi and stores it in R2, outside the release
  folders that are pruned. Images are not stored in git.
- The text places it with Bluebell's `{{IMG src description}}`, which becomes AKN `img`. The
  text around it, such as a legend, stays text.

## Why

About 30 laws (new regions, the IKN) carry their meaning in a map, and the map is lost. UU
28/2014 Pasal 42 huruf b says there is no copyright on peraturan perundang-undangan, so the
images fit `data/`'s CC0. R2's free tier holds 10 GB with free egress (read 2026-11-27).

## What we gave up

- A new kind of data outside git: the images depend on R2 and on the PDFs they were cut from.
- Raster images: a vector map in the PDF loses its sharpness at high zoom.
