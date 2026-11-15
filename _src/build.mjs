// Static site generator. `node _src/build.mjs` writes site/ (committed). No dependencies. Fails on a palette or config defect.
import { mkdirSync, writeFileSync, copyFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, toRGBA, packSheet, fingerprint, KINDS, PALETTES, paletteColourCount, ROLES, toHex, colourName } from './pixelgen.mjs';
import { encodePNG } from './png.mjs';
import { TOKENS, ZONES, wash, measure } from './tokens.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'site');
const SITE = 'https://pixel-art-gen.shadw.app';
const w = (p, s) => { mkdirSync(dirname(join(out, p)), { recursive: true }); writeFileSync(join(out, p), s); };

const m = measure();
if (m.failures.length) { console.error('palette check failed:\n' + m.failures.join('\n')); process.exit(1); }

// ---------- sprite → inline SVG (baked at build time, no JS needed to see art) ----------
function svg(spr, { cls = 'px', label = '' } = {}) {
  const byColour = new Map();
  for (let y = 0; y < spr.h; y++) { let x = 0;
    while (x < spr.w) { const v = spr.d[y * spr.w + x]; if (!v) { x++; continue; } let e = x; while (e < spr.w && spr.d[y * spr.w + e] === v) e++;
      const hex = toHex(spr.colors[ROLES[v]]); if (!byColour.has(hex)) byColour.set(hex, []); byColour.get(hex).push(`M${x} ${y}h${e - x}v1h-${e - x}z`); x = e; } }
  const paths = [...byColour].map(([c, d]) => `<path fill="${c}" d="${d.join('')}"/>`).join('');
  return `<svg class="${cls}" viewBox="0 0 ${spr.w} ${spr.h}" shape-rendering="crispEdges" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>${paths}</svg>`;
}
function svgRGBA(img, label) {
  const by = new Map();
  for (let y = 0; y < img.h; y++) { let x = 0;
    while (x < img.w) { const o = (y * img.w + x) * 4; if (!img.data[o + 3]) { x++; continue; } const k = toHex([img.data[o], img.data[o + 1], img.data[o + 2]]); let e = x + 1;
      while (e < img.w && toHex([img.data[(y * img.w + e) * 4], img.data[(y * img.w + e) * 4 + 1], img.data[(y * img.w + e) * 4 + 2]]) === k && img.data[(y * img.w + e) * 4 + 3]) e++;
      if (!by.has(k)) by.set(k, []); by.get(k).push(`M${x} ${y}h${e - x}v1h-${e - x}z`); x = e; } }
  return `<svg class="px" viewBox="0 0 ${img.w} ${img.h}" shape-rendering="crispEdges" role="img" aria-label="${label}">${[...by].map(([c, d]) => `<path fill="${c}" d="${d.join('')}"/>`).join('')}</svg>`;
}
const hexRGB = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const sp = (kind, bits, seed, palette) => generate({ kind, bits, seed, palette });

// 5x7 bitmap wordmark
const FONT = { P: ['1111.', '1...1', '1...1', '1111.', '1....', '1....', '1....'], I: ['111', '.1.', '.1.', '.1.', '.1.', '.1.', '111'],
  X: ['1...1', '1...1', '.1.1.', '..1..', '.1.1.', '1...1', '1...1'], E: ['11111', '1....', '1....', '1111.', '1....', '1....', '11111'],
  L: ['1....', '1....', '1....', '1....', '1....', '1....', '11111'], G: ['.1111', '1....', '1....', '1.111', '1...1', '1...1', '.111.'],
  N: ['1...1', '11..1', '1.1.1', '1..11', '1...1', '1...1', '1...1'] };
function wordmark(text, fills, cls = 'wordmark') {
  let x = 0, body = ''; [...text].forEach((ch, i) => { const g = FONT[ch], gw = g[0].length; let d = '';
    g.forEach((row, y) => { for (let c = 0; c < gw; c++) if (row[c] === '1') d += `M${x + c} ${y}h1v1h-1z`; });
    body += `<path fill="${fills[i % fills.length]}" d="${d}"/>`; x += gw + 1; });
  return `<svg class="${cls}" viewBox="0 0 ${x - 1} 7" shape-rendering="crispEdges" role="img" aria-label="${text}">${body}</svg>`;
}
const H = TOKENS.dark.hue;
const WM = wordmark('PIXELGEN', [H.studio, H.stack, H.palettes, H.sheets, H.studio, H.stack, H.palettes, H.sheets]);

// ---------- shared chrome ----------
const NAV = [['studio', 'Studio'], ['palettes', 'Palettes'], ['sheets', 'Sheets'], ['stack', 'Stack']];
const page = ({ file, zone, title, desc, body, script }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="color-scheme" content="dark light">
<link rel="canonical" href="${SITE}/${file === 'index' ? '' : file}">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/style.css">
<meta property="og:type" content="website"><meta property="og:site_name" content="PIXELGEN">
<meta property="og:title" content="${title}"><meta property="og:description" content="${desc}">
<meta property="og:url" content="${SITE}/${file === 'index' ? '' : file}">
<meta property="og:image" content="${SITE}/assets/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebApplication', name: 'PIXELGEN', applicationCategory: 'DesignApplication', operatingSystem: 'Any', url: SITE, description: desc, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, license: 'https://opensource.org/licenses/MIT' })}</script>
</head>
<body data-zone="${zone}" data-page="${file}">
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap bar">
<a class="brand" href="/" aria-label="PIXELGEN, home">${wordmark('PIXELGEN', [H.studio, H.stack, H.palettes, H.sheets, H.studio, H.stack, H.palettes, H.sheets], 'brandmark')}</a>
<nav aria-label="Main"><ul>${NAV.map(([z, t]) => `<li><a data-z="${z}" href="/${z}"${z === file ? ' aria-current="page"' : ''}>${t}</a></li>`).join('')}</ul></nav>
</div></header>
<main id="main">
${body}
</main>
<footer class="foot"><div class="wrap">
<p>PIXELGEN is part of the <a href="https://github.com/SolutionsAsService/shadw-gaming-master">SHADW game stack</a>. MIT licence. <a href="https://github.com/SolutionsAsService/pixel-art-gen">Source</a>.</p>
<p>No accounts, no tracking, no network calls after the page loads. Everything is generated in your browser; the sheet you build is kept in this browser only.</p>
</div></footer>
${script ? `<script type="module" src="assets/app.js"></script>` : ''}
</body>
</html>
`;

// ---------- figures, all computed ----------
const nesCount = paletteColourCount('nes'), kindsN = Object.keys(KINDS).length, palN = Object.keys(PALETTES).length;
const snes = paletteColourCount('snes'), md = paletteColourCount('genesis');
const demo = (k, b, s, p) => generate({ kind: k, bits: b, seed: s, palette: p });
const fp = (s) => fingerprint(s);

// ---------- pages ----------
const pages = {};

// Landing: one composed poster, one tile per page, baked SVG
const tHero = demo('hero', 16, 'ember-3', 'snes'), tPal = ['nes', 'c64', 'pico', 'gb'];
const tSheet = packSheet([demo('creature', 8, 'ash-1', 'nes'), demo('item', 8, 'ash-2', 'nes'), demo('creature', 16, 'ash-3', 'snes'), demo('item', 16, 'ash-4', 'snes')], { columns: 2 });
const tIsle = demo('island', 16, 'tide-9', 'snes');
const swatchStrip = (id) => { const p = PALETTES[id]; const all = p.all ? p.all.slice(0, 16) : null; return all ? `<span class="strip" aria-hidden="true">${all.map((c) => `<i style="background:${c}"></i>`).join('')}</span>` : ''; };
pages.index = page({ file: 'index', zone: 'studio', title: 'PIXELGEN: 8-bit and 16-bit pixel art generator',
  desc: `Generate 8-bit and 16-bit pixel art in your browser: ${kindsN} kinds, ${palN} real console palettes, seeded so the same seed gives the same pixels. Export PNG sprite sheets with an atlas for your game.`,
  body: `<section class="slab" aria-labelledby="h1"><div class="wrap">
<h1 id="h1" class="sr">PIXELGEN: 8-bit and 16-bit pixel art generator</h1>
<div class="hero-mark">${WM}</div>
<p class="lede">Creatures, heroes, items and islands in the exact colour sets of real consoles. Same seed, same pixels, every time.</p>
<ul class="poster" aria-label="What PIXELGEN holds">
<li class="tile" data-z="studio"><a href="/studio?kind=hero&amp;bits=16&amp;seed=ember-3"><span class="art">${svg(tHero, { label: tHero.alt })}</span>
<span class="name">Studio</span><span class="fig">${kindsN} kinds, 8 or 16 bit</span><span class="go">Make one</span></a></li>
<li class="tile" data-z="palettes"><a href="/palettes"><span class="art pal">${tPal.map((id) => `<span class="prow"><b>${PALETTES[id].label}</b>${swatchStrip(id)}</span>`).join('')}</span>
<span class="name">Palettes</span><span class="fig">${palN} palettes, NES ${nesCount} listed colours</span><span class="go">See the limits</span></a></li>
<li class="tile" data-z="sheets"><a href="/sheets"><span class="art">${svgRGBA(tSheet, 'A sprite sheet of four sprites: two 8-bit and two 16-bit creatures and items')}</span>
<span class="name">Sheets</span><span class="fig">PNG atlas plus JSON frames</span><span class="go">Build a sheet</span></a></li>
<li class="tile" data-z="stack"><a href="/stack"><span class="art">${svg(tIsle, { label: tIsle.alt })}</span>
<span class="name">Stack</span><span class="fig">Atlas and command line for the SHADW stack</span><span class="go">See the stack</span></a></li>
</ul></div></section>
<section class="wrap band"><h2>Why it looks right</h2>
<ul class="cols">
<li><h3>Real limits</h3><p>8-bit creatures, heroes and items are three colours and transparent, the NES rule (Game Boy: its four greens). 16-bit sprites sit inside the ${snes.toLocaleString('en')}-colour SNES and ${md}-colour Mega Drive colour sets and use at most ten colours, under the limit of 15. Colour is exact; sprite sizes, scanlines and tiles are not simulated.</p></li>
<li><h3>Hand-made habits</h3><p>Dark outline, rim light top left, shade bottom right, and shadows that drift cool while lights drift warm. Islands dither between bands on 16-bit and band flat on 8-bit.</p></li>
<li><h3>Seeded</h3><p>A seed is a short code that always redraws the same sprite. A seed, a kind, a depth and a palette name one sprite for good. The browser and the command line draw identical pixels.</p></li>
</ul></section>`, script: false });

// Studio
const kindRadios = Object.entries(KINDS).map(([k, v], i) => `<label class="chip"><input type="radio" name="kind" value="${k}"${i === 0 ? ' checked' : ''}><span>${v.label}</span></label>`).join('');
pages.studio = page({ file: 'studio', zone: 'studio', title: 'Studio · PIXELGEN', desc: 'Make an 8-bit or 16-bit creature, hero, item or island. Pick a console palette, roll a seed, download the PNG.',
  body: `<div class="wrap studio">
<h1>Studio</h1>
<p class="lede">Pick a kind, a depth and a palette. Roll until something looks like yours, then download it.</p>
<div class="studio-grid">
<form id="controls" class="controls" aria-label="Generator controls" onsubmit="return false">
<fieldset><legend>Kind</legend><div class="chips">${kindRadios}</div></fieldset>
<fieldset><legend>Depth</legend><div class="chips">
<label class="chip"><input type="radio" name="bits" value="8" checked><span>8-bit</span></label>
<label class="chip"><input type="radio" name="bits" value="16"><span>16-bit</span></label></div></fieldset>
<label class="field">Palette<select id="palette" name="palette"></select></label>
<label class="field">Seed <small>a code that redraws the same sprite</small><input id="seed" name="seed" type="text" value="ember" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="40"></label>
<div class="row"><button type="button" id="reroll" class="btn signal">Reroll</button></div>
</form>
<div class="stage">
<div class="frame"><canvas id="preview" width="16" height="16" role="img" aria-label="Generated sprite"></canvas></div>
<p id="desc" class="desc"></p>
<p id="readout" class="readout" aria-live="polite"></p>
<ul id="swatches" class="swatches" aria-label="Colours used"></ul>
<div class="actions">
<label class="field small">Download size<select id="scale"><option value="1">1x</option><option value="4">4x</option><option value="8" selected>8x</option><option value="16">16x</option></select></label>
<button type="button" id="dl" class="btn">Download PNG</button>
<button type="button" id="copy" class="btn">Copy link to this sprite</button>
<button type="button" id="add" class="btn">Add to sheet</button></div>
<p id="status" class="status" role="status"></p>
<noscript><p class="status">The generator needs JavaScript. The pictures on the other pages do not.</p></noscript>
</div></div>
<h2>Twelve more</h2>
<p class="hint">Tap a sprite to make its seed the current one.</p>
<ol id="variants" class="variants" aria-label="Variants of this seed"></ol>
</div>`, script: true });

// Palettes
const pcard = (id) => { const p = PALETTES[id]; const bits = p.bits; const s = demo('hero', bits, 'ember-3', id);
  const swList = p.all ? `<ul class="sw">${p.all.map((c) => `<li style="background:${c}"><span class="sr">${colourName(hexRGB(c))} ${c}</span></li>`).join('')}</ul>` : '';
  const sw = p.all ? (p.all.length > 16 ? `<details><summary>Show all ${p.all.length} colours</summary>${swList}</details>` : swList) : `<p class="ramp" aria-hidden="true">${Array.from({ length: 2 ** p.depth }, (_, i) => { const v = Math.round(i * 255 / (2 ** p.depth - 1)); return `<i style="background:rgb(${v},${v},${v})"></i>`; }).join('')}</p><p class="cap">${p.depth} bits per channel: ${2 ** p.depth} levels each, so ${((2 ** p.depth) ** 3).toLocaleString('en')} colours.</p>`;
  return `<li class="pcard"><div class="pc-art">${svg(s, { label: `Sample in ${p.label} colours. ${s.alt}` })}</div><div><h3>${p.label} <small>${bits}-bit</small></h3>
<p>${paletteColourCount(id).toLocaleString('en')} colours. ${p.note}.</p>${sw}</div></li>`; };
pages.palettes = page({ file: 'palettes', zone: 'palettes', title: 'Palettes · PIXELGEN', desc: `${palN} palettes with the colour limits of the real hardware: NES, Game Boy, C64, SNES, Mega Drive and PICO-8.`,
  body: `<div class="wrap"><h1>Palettes</h1>
<p class="lede">The limits are the look. Each palette below draws the same hero seed, so you can see what the machine took away.</p>
<h2>8-bit</h2><ul class="pcards">${['nes', 'gb', 'c64'].map(pcard).join('')}</ul>
<h2>16-bit</h2><ul class="pcards">${['snes', 'genesis', 'pico'].map(pcard).join('')}</ul>
<h2>How the limits are kept</h2>
<ul class="cols"><li><h3>8-bit sprites</h3><p>Creatures, heroes and items: one outline, one body colour and one light, so three colours and transparent. NES and C64 entries are real palette entries; Game Boy uses its four greens. Islands are backgrounds, not sprites: four to seven colours on NES and C64.</p></li>
<li><h3>16-bit colour depth</h3><p>SNES colours are rounded to 5 bits per channel and Mega Drive colours to 3 bits, the depth of those machines' colour registers. PICO-8 snaps to its fixed 16.</p></li>
<li><h3>Not claimed</h3><p>Sprite size, scanline and tile limits of the real consoles are not enforced. The palettes are exact; the hardware around them is not simulated.</p></li></ul></div>` });

// Sheets
pages.sheets = page({ file: 'sheets', zone: 'sheets', title: 'Sheets · PIXELGEN', desc: 'Build a sprite sheet from a seed and download it as one PNG with a JSON atlas of frame positions, ready for a game engine.',
  body: `<div class="wrap"><h1>Sheets</h1>
<p class="lede">Make a batch from one seed, or add the sprites you picked in the Studio. Download one PNG and a JSON atlas, a map of where each sprite sits in it.</p>
<form id="sheetform" class="controls wide" aria-label="Sheet controls" onsubmit="return false">
<label class="field">Kind<select id="s-kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></label>
<label class="field">Depth<select id="s-bits"><option value="8">8-bit</option><option value="16">16-bit</option></select></label>
<label class="field">Palette<select id="s-palette"></select></label>
<label class="field">Seed<input id="s-seed" type="text" value="ember" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="40"></label>
<label class="field">Count<select id="s-count"><option>4</option><option selected>8</option><option>12</option><option>16</option></select></label>
<label class="field">Columns<select id="s-cols"><option>2</option><option>4</option><option selected>4</option><option>8</option></select></label>
<div class="row"><button type="button" id="s-make" class="btn signal">Make sheet</button>
<button type="button" id="s-picks" class="btn">Add my Studio picks (<span id="pickn">0</span>)</button>
<button type="button" id="s-clear" class="btn">Clear picks</button></div></form>
<div class="frame sheetframe"><canvas id="sheet" width="16" height="16" role="img" aria-label="Sprite sheet preview"></canvas></div>
<p id="s-readout" class="readout" aria-live="polite"></p>
<div class="actions"><label class="field small">PNG size<select id="s-scale"><option value="1">1x</option><option value="2">2x</option><option value="4" selected>4x</option><option value="8">8x</option></select></label>
<button type="button" id="s-png" class="btn">Download sheet.png</button><button type="button" id="s-json" class="btn">Download sheet.json</button></div>
<p id="s-status" class="status" role="status"></p>
<noscript><p class="status">Sheets need JavaScript.</p></noscript></div>`, script: true });

// Stack
const atlasDemo = packSheet([demo('hero', 16, 'ember-3', 'snes'), demo('creature', 8, 'ash-1', 'nes')], { columns: 2, scale: 1 }).atlas;
const cli = 'node _src/render.mjs --kind hero --bits 16 --palette snes --seed ember-3 --scale 8 --out hero.png';
pages.stack = page({ file: 'stack', zone: 'stack', title: 'Stack · PIXELGEN', desc: 'How PIXELGEN fits the SHADW game stack: a seeded, dependency-free sprite generator with a JSON atlas and a command line for build scripts.',
  body: `<div class="wrap"><h1>Stack</h1>
<p class="lede">PIXELGEN is the stack's placeholder-art and prototyping tool. It has no dependencies and no server, so it runs in a browser, in a build script or in CI.</p>
<h2>Use it from a build</h2>
<pre><code>${cli}</code></pre>
<p>Prints one line of JSON, including a fingerprint: a short code that proves two images are identical. Run it twice and the fingerprint matches. For the hero above it prints <code>${fp(demo('hero', 16, 'ember-3', 'snes'))}</code>, and the Studio shows the same pixels for <code>hero · 16-bit · SNES · ember-3</code>.</p>
<h2>Atlas format</h2>
<p>An atlas is one picture plus a map of where each sprite sits. A sheet downloads as <code>sheet.png</code> plus <code>sheet.json</code>. Frames are in pixels, each has a short text description in <code>alt</code>, and each names the seed that makes it again.</p>
<pre><code>${JSON.stringify(atlasDemo, null, 2).replace(/</g, '&lt;')}</code></pre>
<h2>Where it fits</h2>
<ul class="fits">
<li data-z="stack"><h3><a href="https://github.com/PrometheusIntelligence/shadw-terrain">SHADW Terrain</a></h3><p>Islands are small height-banded maps with a coast. A fit for test overworlds and thumbnails. Not wired in yet.</p></li>
<li data-z="stack"><h3><a href="https://github.com/PrometheusIntelligence/shadw-game-store">SHADW Game Store</a></h3><p>Store art for a game that has none yet: capsule icons and placeholder screenshots. Not wired in yet.</p></li>
<li data-z="stack"><h3><a href="https://github.com/SolutionsAsService/shadw-modding">SHADW Modding</a></h3><p>An art pack for a mod: a sheet, an atlas and the seeds that rebuild it. Not wired in yet.</p></li>
<li data-z="stack"><h3><a href="https://github.com/SolutionsAsService/shadw-gaming-master">Gaming master index</a></h3><p>An index entry as a tool is proposed in that repository, pending merge to its main branch.</p></li></ul>
<h2>Limits, stated</h2>
<ul class="plain"><li>Sprites are 16 by 16 or 32 by 32 (islands 32 or 64). There is no animation yet.</li>
<li>Palettes are exact; console sprite counts and tile rules are not simulated.</li>
<li>The art is procedural, so it is a start for an artist, not a replacement.</li></ul></div>` });

// ---------- write ----------
for (const [f, html] of Object.entries(pages)) w(`${f}.html`, html);
const css = readFileSync(join(root, '_src', 'style.css'), 'utf8');
const vars = (mode) => `--ground:${TOKENS[mode].ground};--slab:${TOKENS.dark.slab};--ink:${TOKENS[mode].ink};--ink2:${TOKENS[mode].ink2};--signal:${TOKENS[mode].signal};` +
  ZONES.map((z) => `--${z}:${TOKENS[mode].hue[z]};--${z}-wash:${wash(mode, z)};`).join('') + ZONES.map((z) => `--${z}-slab:${TOKENS.dark.hue[z]};`).join('');
w('assets/style.css', `/* generated by _src/build.mjs from _src/style.css and _src/tokens.mjs */\n:root{color-scheme:dark light;${vars('dark')}}\n@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){${vars('light')}}}\n${css}`);
copyFileSync(join(root, '_src', 'pixelgen.mjs'), join(out, 'assets', 'pixelgen.js'));
copyFileSync(join(root, '_src', 'app.js'), join(out, 'assets', 'app.js'));

const og = { w: 1200, h: 630, data: new Uint8ClampedArray(1200 * 630 * 4) };
const bg = [7, 7, 26]; for (let i = 0; i < og.data.length; i += 4) { og.data[i] = bg[0]; og.data[i + 1] = bg[1]; og.data[i + 2] = bg[2]; og.data[i + 3] = 255; }
const blit = (img, x0, y0) => { for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const a = (y * img.w + x) * 4; if (!img.data[a + 3]) continue; const b = ((y0 + y) * 1200 + x0 + x) * 4; for (let k = 0; k < 4; k++) og.data[b + k] = img.data[a + k]; } };
[['hero', 16, 'ember-3', 'snes', 0], ['creature', 16, 'ember-7', 'snes', 1], ['island', 16, 'tide-9', 'snes', 2], ['creature', 8, 'ash-1', 'nes', 3]].forEach(([k, b, s, p, i]) => {
  const sprite = demo(k, b, s, p), sc = k === 'island' ? 4 : (b === 8 ? 12 : 6); blit(toRGBA(sprite, sc), 60 + i * 285, 300 + (256 - sprite.h * sc) / 2 | 0); });
// wordmark, 5x7 font at 12px cells
let ox = 60; [...'PIXELGEN'].forEach((ch, i) => { const g = FONT[ch], gw = g[0].length, col = [H.studio, H.stack, H.palettes, H.sheets][i % 4].slice(1).match(/../g).map((x) => parseInt(x, 16));
  g.forEach((row, y) => [...row].forEach((c, x) => { if (c === '1') for (let j = 0; j < 12; j++) for (let k = 0; k < 12; k++) { const b = ((70 + y * 12 + j) * 1200 + ox + x * 12 + k) * 4; og.data[b] = col[0]; og.data[b + 1] = col[1]; og.data[b + 2] = col[2]; } }));
  ox += (gw + 1) * 12; });
writeFileSync(join(out, 'assets', 'og.png'), encodePNG(og));
w('favicon.svg', svg(demo('creature', 8, 'ash-1', 'nes'), { cls: '' }).replace('<svg class=""', '<svg xmlns="http://www.w3.org/2000/svg"').replace(' aria-hidden="true"', ''));
w('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
w('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['', 'studio', 'palettes', 'sheets', 'stack'].map((p) => `<url><loc>${SITE}/${p}</loc></url>`).join('\n')}\n</urlset>\n`);
w('vercel.json', JSON.stringify({ $schema: 'https://openapi.vercel.sh/vercel.json', framework: null, installCommand: '', buildCommand: '', outputDirectory: '.', cleanUrls: true, fluid: true }, null, 2) + '\n');
console.log(`built ${Object.keys(pages).length} pages; palette checks ${m.rows.length} ok; palettes=${palN} kinds=${kindsN} nes=${nesCount} snes=${snes} md=${md}`);
