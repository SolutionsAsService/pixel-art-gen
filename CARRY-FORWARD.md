# Carry-forward ledger (facts about the medium, measured in this run)
- A generated sentence is a claim: check it against the pixels. Roles (`wd`, `g1`...) can share a colour on some palettes (Game Boy: sea = grass; PICO-8: sea = forest), so role-derived text lies by eye. (Cairo R4: 400/400 Game Boy islands off by more than 2 points.) Changed M7.
- "Three colours plus transparent" holds for 8-bit creatures, heroes and items on NES and C64 only; Game Boy sprites reach 4, NES/C64 islands 4 to 7, 16-bit sprites reach 10. Changed copy in M4.
- A CSS rule `.tile .art{align-items:center}` (two classes) beats `.pal{align-items:stretch}` (one class): the palette strips shrank to 46 px. Fixed by `.tile .art.pal`. (M4)
- `id="main"` on both `<main>` and a `<canvas>`: `querySelector('#main')` returned `<main>` and threw `getContext is not a function`. Renamed the canvas `preview`. (M1)
- `tools/measure.py` and `check_floor.py` render a copy by `file://`; root-absolute asset URLs (`/assets/style.css`) do not resolve there, so the page measured unstyled and failed 8 touch-target checks that were not real. Asset links are relative to the page. (M4)
- A `margin-top` on the first heading inside `<main>` collapses through it and shows the body ground as a white band over a tinted page. `display:flow-root` on `main`. (M4)
- A ΔE floor of 30 between hues is a statement about typical vision: simulated deuteranopia puts light-mode studio/stack at ΔE 1.4. Meaning rests on labels, glyphs and fill, not hue.
- Making the hero tile 1.9fr wide gave 375 px art but a poster bottom of 814 px (fold 800): the first-screen rule refused it; 1.45fr gives 311 px and 749 px. (M6)
- Rebuilding a list on selection drops keyboard focus; keep the DOM and set `aria-pressed`. (M5)
