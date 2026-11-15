// pixelgen: deterministic 8-bit / 16-bit sprite and island generator.
// DOM-free. The same (kind, bits, palette, seed) gives the same pixels in a browser and in Node.

export const ROLES = ['_', 'ol', 'c1', 'c2', 'c3', 'a1', 'a2', 'a3', 'ey', 'wh', 'sk', 'hr',
  'wd', 'wl', 'sa', 'g1', 'g2', 'fo', 'rk', 'sn'];
const R = Object.fromEntries(ROLES.map((r, i) => [r, i]));

export const KINDS = {
  creature: { label: 'Creature', size: { 8: 16, 16: 32 } },
  hero: { label: 'Hero', size: { 8: 16, 16: 32 } },
  item: { label: 'Item', size: { 8: 16, 16: 32 } },
  island: { label: 'Island', size: { 8: 32, 16: 64 } },
};

// ---------- seeded random ----------
export function rng(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = (h ^ (h >>> 16)) >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (n) => Math.floor(next() * n);
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  return next;
}

// ---------- palettes (real hardware gamuts) ----------
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
export const toHex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

// NES 2C02 (FCEUX default), by row: dark, mid, light, pale. Columns 1..C are the hues.
const NES_ROWS = [
  ['#0000FC', '#0000BC', '#4428BC', '#940084', '#A80020', '#A81000', '#881400', '#503000', '#007800', '#006800', '#005800', '#004058'],
  ['#0078F8', '#0058F8', '#6844FC', '#D800CC', '#E40058', '#F83800', '#E45C10', '#AC7C00', '#00B800', '#00A800', '#00A844', '#008888'],
  ['#3CBCFC', '#6888FC', '#9878F8', '#F878F8', '#F85898', '#F87858', '#FCA044', '#F8B800', '#B8F818', '#58D854', '#58F898', '#00E8D8'],
  ['#A4E4FC', '#B8B8F8', '#D8B8F8', '#F8B8F8', '#F8A4C0', '#F0D0B0', '#FCE0A8', '#F8D878', '#D8F878', '#B8F8B8', '#B8F8D8', '#00FCFC'],
];
const NES_GREYS = ['#000000', '#7C7C7C', '#BCBCBC', '#F8F8F8', '#FCFCFC', '#787878'];
const GB = ['#0F380F', '#306230', '#8BAC0F', '#9BBC0F'];
// C64 (Pepto): [mid, light] pairs that read as one hue
const C64_RAMPS = [['#68372B', '#9A6759'], ['#6F3D86', '#6C5EB5'], ['#588D43', '#9AD284'], ['#352879', '#6C5EB5'],
  ['#6F4F25', '#B8C76F'], ['#444444', '#959595'], ['#70A4B2', '#FFFFFF']];
const C64_ALL = ['#000000', '#FFFFFF', '#68372B', '#70A4B2', '#6F3D86', '#588D43', '#352879', '#B8C76F', '#6F4F25', '#433900',
  '#9A6759', '#444444', '#6C6C6C', '#9AD284', '#6C5EB5', '#959595'];

export const PALETTES = {
  nes: { label: 'NES', bits: 8, note: 'Sprites use 3 colours plus transparent', all: unique(NES_ROWS.flat().concat(NES_GREYS)) },
  gb: { label: 'Game Boy', bits: 8, note: 'The four greens of the DMG screen', all: GB },
  c64: { label: 'C64', bits: 8, note: 'Sprites use 3 colours plus transparent', all: C64_ALL },
  snes: { label: 'SNES', bits: 16, note: '15-bit colour. Sprites use up to 15 colours plus transparent', depth: 5 },
  genesis: { label: 'Mega Drive', bits: 16, note: '9-bit colour. Sprites use up to 15 colours plus transparent', depth: 3 },
  pico: { label: 'PICO-8', bits: 16, note: 'A fixed palette', all: ['#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
    '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'] },
};
function unique(a) { return [...new Set(a.map((s) => s.toUpperCase()))]; }
export const paletteColourCount = (id) => {
  const p = PALETTES[id];
  if (p.all) return p.all.length;
  const levels = 2 ** p.depth; return levels ** 3;
};

const hsl = (h, s, l) => {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};
const quant = (c, depth) => { const n = 2 ** depth - 1; return c.map((v) => Math.round(Math.round(v / 255 * n) * 255 / n)); };
const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const nearest = (c, list) => list.reduce((b, x) => (dist(x, c) < dist(b, c) ? x : b));

// hue-shifted ramp: shadows drift cool, lights drift warm (the 16-bit habit)
const ramp = (h) => [hsl(h - 22, 52, 20), hsl(h - 8, 58, 36), hsl(h, 62, 52), hsl(h + 14, 66, 72)];
const SKIN = [[60, 38, 18], [190, 122, 78], [232, 168, 120], [250, 206, 168]];

/** Returns { colors: Uint8Array-like [role -> [r,g,b]], used() } for a seed. */
export function makePalette(id, bits, rand) {
  const p = PALETTES[id]; const C = {};
  const set = (role, c) => { C[role] = c; };
  if (bits === 8) {
    let dark, mid, light;
    if (id === 'gb') {
      [dark, mid, light] = [hex(GB[0]), hex(GB[1]), hex(GB[2])];
      Object.assign(C, { ol: dark, c1: mid, c2: mid, c3: light, a1: mid, a2: light, a3: light, ey: dark, wh: hex(GB[3]), sk: light, hr: dark });
      set('wd', mid); set('wl', light); set('sa', hex(GB[3])); set('g1', mid); set('g2', light); set('fo', dark); set('rk', mid); set('sn', hex(GB[3]));
    } else if (id === 'nes') {
      const col = rand.int(NES_ROWS[1].length);
      mid = hex(NES_ROWS[1][col]); light = hex(NES_ROWS[3][col]); dark = hex('#000000');
      Object.assign(C, { ol: dark, c1: mid, c2: mid, c3: light, a1: mid, a2: light, a3: light, ey: dark, wh: light, sk: light, hr: dark });
      // terrain: 8 colours of the 13 a background may use
      set('wd', hex('#0000BC')); set('wl', hex('#3CBCFC')); set('sa', hex('#F8D878')); set('g1', hex('#00A800'));
      set('g2', hex('#58D854')); set('fo', hex('#005800')); set('rk', hex('#7C7C7C')); set('sn', hex('#FCFCFC'));
    } else { // c64
      const [m, l] = rand.pick(C64_RAMPS);
      mid = hex(m); light = hex(l); dark = hex('#000000');
      Object.assign(C, { ol: dark, c1: mid, c2: mid, c3: light, a1: mid, a2: light, a3: light, ey: dark, wh: light, sk: light, hr: dark });
      set('wd', hex('#352879')); set('wl', hex('#6C5EB5')); set('sa', hex('#B8C76F')); set('g1', hex('#588D43'));
      set('g2', hex('#9AD284')); set('fo', hex('#433900')); set('rk', hex('#6C6C6C')); set('sn', hex('#FFFFFF'));
    }
  } else {
    const h1 = rand.int(360), h2 = h1 + 110 + rand.int(140);
    const A = ramp(h1), B = ramp(h2);
    const sk = rand.pick([SKIN, [[70, 40, 24], [150, 96, 60], [196, 140, 96], [226, 178, 132]], [[88, 54, 34], [196, 132, 90], [236, 176, 128], [255, 214, 176]]]);
    Object.assign(C, { ol: hsl(h1 + 230, 45, 9), c1: A[0], c2: A[1], c3: A[3], a1: B[0], a2: B[2], a3: B[3], ey: [20, 14, 30], wh: [250, 246, 238],
      sk: sk[2], hr: rand.pick([A[0], B[0], hsl(30, 55, 22), hsl(48, 80, 58), [236, 236, 244]]) });
    C.sk = sk[2]; C.skd = sk[1];
    Object.assign(C, { wd: hsl(222, 62, 28), wl: hsl(204, 64, 50), sa: hsl(46, 62, 72), g1: hsl(112, 46, 42), g2: hsl(98, 52, 54), fo: hsl(142, 46, 24), rk: hsl(250, 12, 44), sn: hsl(210, 30, 96) });
  }
  if (bits === 16) {
    if (id === 'pico') for (const k in C) C[k] = nearest(C[k], PALETTES.pico.all.map(hex));
    else for (const k in C) C[k] = quant(C[k], p.depth);
  }
  return C;
}

// ---------- plain-language names ----------
const NAMES = [['black', [0, 0, 0]], ['white', [250, 250, 250]], ['grey', [128, 128, 128]], ['light grey', [190, 190, 195]], ['red', [220, 40, 40]],
  ['dark red', [120, 20, 20]], ['orange', [240, 140, 30]], ['brown', [120, 70, 30]], ['tan', [225, 195, 140]], ['yellow', [240, 220, 50]], ['olive', [125, 130, 30]],
  ['lime', [150, 230, 40]], ['green', [40, 170, 60]], ['dark green', [20, 80, 40]], ['teal', [0, 140, 140]], ['cyan', [70, 220, 230]], ['sky blue', [90, 170, 250]],
  ['blue', [40, 80, 230]], ['mint', [140, 230, 200]], ['light green', [150, 230, 140]], ['light blue', [160, 200, 250]], ['peach', [250, 200, 160]], ['lavender', [200, 180, 240]], ['dark blue', [20, 40, 150]], ['dark grey', [64, 64, 70]], ['salmon', [240, 120, 100]], ['gold', [200, 150, 20]], ['navy', [20, 30, 110]], ['purple', [130, 50, 170]], ['violet', [140, 120, 240]], ['magenta', [210, 30, 190]], ['pink', [245, 130, 170]], ['maroon', [130, 20, 70]]];
export const colourName = (c) => NAMES.reduce((b, n) => (dist(n[1], c) < dist(b[1], c) ? n : b))[0];

// ---------- grid helpers ----------
const grid = (w, h) => ({ w, h, d: new Uint8Array(w * h) });
const at = (g, x, y) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? 0 : g.d[y * g.w + x]);
const put = (g, x, y, v) => { if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.d[y * g.w + x] = v; };
const rect = (g, x, y, w, h, v) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(g, x + i, y + j, v); };

function outline(g, role = R.ol) {
  const src = g.d.slice();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (src[y * g.w + x]) continue;
    if ((x > 0 && src[y * g.w + x - 1]) || (x < g.w - 1 && src[y * g.w + x + 1]) || (y > 0 && src[(y - 1) * g.w + x]) || (y < g.h - 1 && src[(y + 1) * g.w + x])) g.d[y * g.w + x] = role;
  }
}
// rim light on top-left edges, shade on bottom-right edges of the main body role
function shade(g, bits, main, [lo, hi]) {
  const src = g.d.slice(); const s = (x, y) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? 0 : src[y * g.w + x]);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (src[y * g.w + x] !== main) continue;
    const topLeft = s(x - 1, y) === 0 || s(x, y - 1) === 0 || (bits === 16 && (s(x - 1, y - 1) === 0));
    const botRight = s(x + 1, y) === 0 || s(x, y + 1) === 0;
    if (topLeft && !botRight) g.d[y * g.w + x] = hi;
    else if (bits === 16 && botRight && !topLeft) g.d[y * g.w + x] = lo;
  }
}

// ---------- generators ----------
function creature(rand, bits) {
  const S = KINDS.creature.size[bits]; const g = grid(S, S); const hw = S / 2; const u = S / 16;
  // cellular fill on the left half, mirrored: a body that is always a single blob
  let a = grid(hw, S);
  for (let y = 2 * u; y < S - 2 * u; y++) for (let x = 1; x < hw; x++) {
    const dx = (hw - x) / hw, dy = Math.abs(y - S * 0.58) / (S * 0.42);
    put(a, x, y, rand() < 0.86 - 0.5 * (dx * dx + dy * dy) + 0.18 ? 1 : 0);
  }
  for (let pass = 0; pass < 2; pass++) {
    const b = grid(hw, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < hw; x++) {
      let n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) n += (x + i >= hw ? at(a, hw - 1, y + j) : at(a, x + i, y + j));
      put(b, x, y, n >= 5 ? 1 : 0);
    }
    a = b;
  }
  // keep the component that touches the centre line
  const seen = new Uint8Array(hw * S); const stack = []; let best = [];
  for (let y = 0; y < S; y++) if (at(a, hw - 1, y) && !seen[y * hw + hw - 1]) {
    const comp = []; stack.push([hw - 1, y]); seen[y * hw + hw - 1] = 1;
    while (stack.length) { const [x, yy] = stack.pop(); comp.push([x, yy]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = yy + dy;
        if (at(a, nx, ny) && !seen[ny * hw + nx] && nx < hw) { seen[ny * hw + nx] = 1; stack.push([nx, ny]); } } }
    if (comp.length > best.length) best = comp;
  }
  if (best.length < S * 2) { for (let y = 5 * u; y < 13 * u; y++) for (let x = 3 * u; x < hw; x++) best.push([x, y]); }
  for (const [x, y] of best) { put(g, x, y, R.c2); put(g, S - 1 - x, y, R.c2); }
  // traits
  let top = S, bot = 0, left = hw; for (const [x, y] of best) { top = Math.min(top, y); bot = Math.max(bot, y); left = Math.min(left, x); }
  const ears = rand.int(3), tail = rand() < 0.55, fangs = rand() < 0.5, eyes = 1 + rand.int(2);
  if (ears === 0) { for (const sx of [left + u, S - 1 - left - u]) rect(g, sx - (sx > hw ? u - 1 : 0), top - 2 * u, u, 2 * u, R.c2); }
  if (ears === 1) { for (const sx of [left, S - left - 2 * u]) rect(g, sx, top - 2 * u, 2 * u, 2 * u, R.a2); }
  if (tail) { const ty = bot - 3 * u; for (let i = 0; i < 4 * u; i++) put(g, S - 1 - left + 1 + i, ty - (i >> (bits === 16 ? 2 : 1)), R.a2); }
  const ey = top + Math.max(2, Math.floor((bot - top) * 0.32));
  for (const ex of eyes === 1 ? [hw - 1, hw] : [hw - 3 * u, hw + 3 * u - 1]) {
    rect(g, ex, ey, u, u, R.wh); if (bits === 16) put(g, ex + (ex < hw ? 1 : 0), ey + 1, R.ey); else put(g, ex, ey, R.ey);
  }
  const my = ey + 3 * u; rect(g, hw - 2 * u, my, 4 * u, 1, R.ey);
  if (fangs) { put(g, hw - 2 * u, my + 1, R.wh); put(g, hw + 2 * u - 1, my + 1, R.wh); if (bits === 16) { put(g, hw - 2 * u, my + 2, R.wh); put(g, hw + 2 * u - 1, my + 2, R.wh); } }
  for (let i = 0; i < 2; i++) rect(g, hw - 4 * u + i * 6 * u, bot + 1, 2 * u, Math.min(u, S - bot - 2) , R.a1);
  shade(g, bits, R.c2, [R.c1, R.c3]);
  outline(g);
  g.meta = { ears, tail, fangs, eyes };
  return g;
}

function hero(rand, bits) {
  const S = KINDS.hero.size[bits]; const g = grid(S, S); const u = S / 16;
  const r = (x, y, w, h, v) => rect(g, x * u, y * u, w * u, h * u, v);
  const hair = rand.int(3), weapon = rand.int(3), cape = rand() < 0.4;
  if (cape) r(4, 7, 8, 7, R.a1);
  r(5, 2, 6, 5, R.sk);
  if (hair === 0) { r(4, 1, 8, 3, R.hr); }
  else if (hair === 1) { r(4, 1, 8, 3, R.hr); r(4, 4, 1, 3, R.hr); r(11, 4, 1, 3, R.hr); }
  else { r(4, 1, 8, 2, R.hr); for (const x of [4, 7, 10]) r(x, 0, 2, 1, R.hr); }
  r(6, 5, 1, 1, R.ey); r(9, 5, 1, 1, R.ey);
  r(4, 7, 8, 5, R.c2); r(4, 11, 8, 1, R.a2); r(2, 7, 2, 4, R.c2); r(12, 7, 2, 4, R.c2); r(2, 11, 2, 1, R.sk); r(12, 11, 2, 1, R.sk);
  r(5, 12, 2, 3, R.c1); r(9, 12, 2, 3, R.c1); r(4, 15, 3, 1, R.a1); r(9, 15, 3, 1, R.a1);
  if (weapon === 0) { r(14, 2, 1, 8, R.wh); r(13, 10, 3, 1, R.a2); }
  else if (weapon === 1) { r(14, 1, 1, 12, R.a3); r(13, 0, 3, 2, R.a2); }
  else { r(0, 7, 3, 5, R.a2); r(1, 8, 1, 3, R.wh); }
  if (bits === 16) { r(6, 8, 4, 1, R.c3); r(7, 3, 1, 1, R.sk); }
  shade(g, bits, R.c2, [R.c1, R.c3]);
  outline(g);
  g.meta = { hair, weapon, cape };
  return g;
}

function item(rand, bits) {
  const S = KINDS.item.size[bits]; const g = grid(S, S); const u = S / 16; const r = (x, y, w, h, v) => rect(g, x * u, y * u, w * u, h * u, v);
  const t = rand.int(5);
  if (t === 0) { // sword, diagonal
    for (let i = 0; i < 10; i++) rect(g, (3 + i) * u, (11 - i) * u, 2 * u, 2 * u, R.wh);
    r(2, 10, 3, 3, R.a2); r(1, 12, 3, 3, R.c2); r(11, 2, 3, 3, R.c3);
  } else if (t === 1) { // potion
    r(6, 2, 4, 2, R.a2); r(7, 4, 2, 2, R.wh); r(4, 6, 8, 8, R.c2); r(5, 7, 2, 4, R.c3); r(4, 12, 8, 2, R.c1);
  } else if (t === 2) { // gem
    r(5, 3, 6, 2, R.c3); r(3, 5, 10, 3, R.c2); r(5, 8, 6, 3, R.c2); r(7, 11, 2, 2, R.c1); r(5, 5, 2, 2, R.wh);
  } else if (t === 3) { // key
    r(3, 3, 5, 5, R.a2); r(5, 5, 1, 1, 0); r(8, 6, 6, 2, R.a2); r(11, 8, 2, 3, R.a2); r(13, 8, 1, 2, R.a2);
  } else { // coin
    r(5, 3, 6, 10, R.a2); r(3, 5, 10, 6, R.a2); r(7, 5, 2, 6, R.a3); r(4, 6, 1, 4, R.a3);
  }
  shade(g, bits, R.c2, [R.c1, R.c3]);
  outline(g);
  g.meta = { t };
  return g;
}

// ---------- islands ----------
function noise2(rand) {
  const perm = Array.from({ length: 256 }, () => rand()); const v = (x, y) => perm[((x * 374761393 + y * 668265263) >>> 0) % 256];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
}
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
function island(rand, bits) {
  const S = KINDS.island.size[bits]; const g = grid(S, S); const n = noise2(rand); const ox = rand() * 50, oy = rand() * 50;
  const bands = [[0.30, R.wd], [0.40, R.wl], [0.46, R.sa], [0.60, R.g1], [0.72, R.g2], [0.82, R.fo], [0.95, R.rk], [9, R.sn]];
  const bandsLo = bits === 8 ? [[0.40, R.wd], [0.46, R.sa], [0.62, R.g1], [0.74, R.g2], [0.86, R.fo], [0.98, R.rk], [9, R.sn]] : bands;
  const useBands = bits === 8 ? bandsLo : bands;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = x / S * 2 - 1, ny = y / S * 2 - 1;
    let h = 0.55 * n(x / S * 4 + ox, y / S * 4 + oy) + 0.3 * n(x / S * 8 + ox, y / S * 8 + oy) + 0.15 * n(x / S * 16 + ox, y / S * 16 + oy);
    h = h * 1.25 - 0.1 - 0.95 * (nx * nx + ny * ny) ** 0.9 + 0.35;
    let i = useBands.findIndex(([t]) => h < t);
    if (bits === 16 && i > 0 && i < useBands.length - 1) {
      const lo = useBands[i - 1][0], hi = useBands[i][0], th = (BAYER[y & 3][x & 3] + 0.5) / 16 * 0.05;
      if (h - lo < 0.025 && h - lo < th * 1.0) i -= 1; else if (hi - h < 0.025 && hi - h < th) i += 1;
    }
    g.d[y * S + x] = useBands[Math.max(0, i)][1];
  }
  // foam line on 16-bit coasts
  if (bits === 16) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = g.d[y * S + x]; if (v !== R.wd && v !== R.wl) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const q = at(g, x + dx, y + dy); return q === R.sa; }) && (x + y) % 2 === 0) g.d[y * S + x] = R.wh;
  }
  return g;
}

const MAKERS = { creature, hero, item, island };

const EARS = ['antennae', 'round ears', 'no ears'], HAIR = ['a cap of hair', 'long hair', 'spiky hair'], WEAPON = ['a sword', 'a staff', 'a shield'], ITEM = ['sword', 'potion bottle', 'gem', 'key', 'coin'];
/** One plain sentence saying what is drawn, for alt text and for people who cannot see the sprite. */
export function describe(spr) {
  const a = (n) => (/^[aeiou]/.test(n) ? 'An' : 'A'), body = colourName(spr.colors.c2), m = spr.meta || {}, bits = `${spr.bits}-bit`;
  if (spr.kind === 'creature') { const feats = [EARS[m.ears], m.eyes === 1 ? 'one eye' : 'two eyes', m.fangs ? 'fangs' : null, m.tail ? 'a tail' : null].filter((x) => x && x !== 'no ears');
    return `${a(body)} ${body} ${bits} creature with ${feats.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`; }
  if (spr.kind === 'hero') return `${a(body)} ${body} ${bits} hero with ${HAIR[m.hair]}, carrying ${WEAPON[m.weapon]}${m.cape ? ', wearing a cape' : ''}.`;
  if (spr.kind === 'item') { const c = colourName(spr.colors[m.t === 0 ? 'wh' : m.t === 3 || m.t === 4 ? 'a2' : 'c2']); return `${a(c)} ${c} ${bits} ${ITEM[m.t]}.`; }
  // Only say what the colours let a viewer see: a role is mentioned only if no other role present in the picture shares its colour.
  const present = new Map(); for (const v of spr.d) present.set(v, (present.get(v) || 0) + 1);
  const hexOf = (role) => toHex(spr.colors[ROLES[role]]), roles = [...present.keys()];
  const clear = (role) => present.has(role) && roles.every((o) => o === role || hexOf(o) !== hexOf(role));
  const water = [R.wd, R.wl], landRoles = roles.filter((r) => !water.includes(r));
  const seaDistinct = water.filter((w) => present.has(w)).every((w) => landRoles.every((o) => hexOf(o) !== hexOf(w)));
  const wn = water.reduce((t, w) => t + (present.get(w) || 0), 0), land = Math.round((1 - wn / spr.d.length) * 100);
  const lead = `${spr.bits === 8 ? 'An' : 'A'} ${bits} island seen from above`;
  if (!seaDistinct) return `${lead}; in ${PALETTES[spr.palette].label} colours the sea shares shades with the land.`;
  const parts = ['grass', clear(R.fo) ? 'forest' : null, clear(R.rk) ? 'rock' : null].filter(Boolean);
  return `${lead}, about ${land}% land with ${clear(R.sa) ? 'sandy coast, ' : ''}${parts.join(', ').replace(/, ([^,]*)$/, ' and $1')}${clear(R.sn) ? ', and a snowy peak' : ''}.`;
}

/** Generate a sprite. Returns { w, h, d (role indices), colors, id, usedColours }. */
export function generate({ kind = 'creature', bits = 8, palette, seed = 'shadw' } = {}) {
  palette = palette || (bits === 8 ? 'nes' : 'snes');
  if (PALETTES[palette].bits !== bits) palette = bits === 8 ? 'nes' : 'snes';
  const rand = rng(`${kind}|${bits}|${palette}|${seed}`);
  const colors = makePalette(palette, bits, rng(`${palette}|${seed}`));
  const g = MAKERS[kind](rand, bits);
  const used = new Set(); for (const v of g.d) if (v) used.add(toHex(colors[ROLES[v]]));
  const spr = { kind, bits, palette, seed: String(seed), w: g.w, h: g.h, d: g.d, colors, usedColours: [...used], meta: g.meta };
  spr.alt = describe(spr);
  return spr;
}

/** RGBA bytes at integer scale. */
export function toRGBA(spr, scale = 1) {
  const W = spr.w * scale, H = spr.h * scale, out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = spr.d[Math.floor(y / scale) * spr.w + Math.floor(x / scale)]; if (!v) continue;
    const c = spr.colors[ROLES[v]]; const o = (y * W + x) * 4; out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
  }
  return { w: W, h: H, data: out };
}

/** FNV-1a hash of the sprite's pixels, for determinism checks. */
export function fingerprint(spr) {
  let h = 2166136261; const { data } = toRGBA(spr, 1);
  for (const b of data) { h ^= b; h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Lay sprites out on one atlas. Returns { w, h, data (RGBA), atlas (JSON-able) }. */
export function packSheet(sprites, { columns = 4, scale = 1, pad = 1 } = {}) {
  const cw = Math.max(...sprites.map((s) => s.w)) * scale + pad * 2, ch = Math.max(...sprites.map((s) => s.h)) * scale + pad * 2;
  const rows = Math.ceil(sprites.length / columns), W = cw * Math.min(columns, sprites.length), H = ch * rows;
  const data = new Uint8ClampedArray(W * H * 4); const frames = [];
  sprites.forEach((s, i) => {
    const cx = (i % columns) * cw + pad, cy = Math.floor(i / columns) * ch + pad, img = toRGBA(s, scale);
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const a = (y * img.w + x) * 4, b = ((cy + y) * W + cx + x) * 4; for (let k = 0; k < 4; k++) data[b + k] = img.data[a + k]; }
    frames.push({ name: `${s.kind}-${s.seed}`, alt: s.alt, x: cx, y: cy, w: img.w, h: img.h, kind: s.kind, bits: s.bits, palette: s.palette, seed: s.seed, colours: s.usedColours.length });
  });
  return { w: W, h: H, data, atlas: { format: 'shadw-pixelgen-atlas/1', image: 'sheet.png', size: { w: W, h: H }, scale, frames } };
}
