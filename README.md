# PIXELGEN

An 8-bit and 16-bit pixel art generator that runs in the browser. Creatures, heroes, items and islands, drawn inside the
colour limits of real hardware (NES, Game Boy, C64, SNES, Mega Drive, PICO-8). Part of the
[SHADW game stack](https://github.com/SolutionsAsService/shadw-gaming-master). Live at https://pixel-art-gen.shadw.app.

A seed, a kind, a depth and a palette name one sprite for good: the browser and the command line draw identical pixels.

## Pages

| Page | What it does |
|---|---|
| Studio | Pick kind, depth, palette and seed; download a PNG at 1x to 16x |
| Palettes | The six palettes, their colour counts and the limits kept |
| Sheets | Build a sprite sheet and download `sheet.png` plus a `sheet.json` atlas |
| Stack | How it fits the other SHADW repos; atlas format; command line |

## Command line

Node 22 or newer. Nothing to install.

```bash
node _src/render.mjs --kind hero --bits 16 --palette snes --seed ember-3 --scale 8 --out hero.png
```

Kinds: `creature`, `hero`, `item`, `island`. Depths: `8`, `16`. Palettes: `nes`, `gb`, `c64` (8-bit); `snes`, `genesis`, `pico` (16-bit).
It prints one line of JSON with a pixel fingerprint.

## Layout

```
_src/pixelgen.mjs   the generator (no DOM, no dependencies)
_src/build.mjs      writes site/ from the generator and the tokens
_src/tokens.mjs     colours, contrast and distance checks; the build fails if one fails
site/               the committed, deployable static site
```

Rebuild with `node _src/build.mjs`. The deploy runs no build step.

## What it does not do

Palettes are exact; console sprite counts, scanlines and tile rules are not simulated. There is no animation yet. The art is
procedural, so it is a start for an artist, not a replacement.

## Licence

MIT. See `LICENSE`.
