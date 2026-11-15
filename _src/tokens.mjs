// Palette source: the NES PPU palette (2C02), the machine the 8-bit half of this site imitates.
// Hues are NES columns; light-mode hues are the same columns darkened one row; the reserved signal is NES magenta.
export const ZONES = ['studio', 'palettes', 'sheets', 'stack'];
export const TOKENS = {
  dark: { ground: '#0E0E24', slab: '#07071A', ink: '#F8F8F8', ink2: '#BCBCBC',
    hue: { studio: '#F85A30', palettes: '#58D854', sheets: '#3CBCFC', stack: '#F8B800' }, signal: '#F878F8' },
  light: { ground: '#F8F8F8', slab: '#07071A', ink: '#0C0C28', ink2: '#4A4A5E',
    hue: { studio: '#A81000', palettes: '#006800', sheets: '#0050E0', stack: '#7A5800' }, signal: '#940084' },
};
export const WASH_MIX = 0.12;

const h2 = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export const contrast = (a, b) => { const [x, y] = [lum(h2(a)), lum(h2(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
export const mix = (a, b, t) => '#' + h2(a).map((v, i) => Math.round(v + (h2(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
export function lab(hex) {
  const [r, g, b] = h2(hex).map(lin);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
export const deltaE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
export const wash = (mode, zone) => mix(TOKENS[mode].ground, TOKENS[mode].hue[zone], WASH_MIX);

/** Returns { rows, failures }. Every row is one measured pair. */
export function measure() {
  const rows = [], failures = [];
  const add = (what, value, min, mode) => { const ok = value >= min; rows.push({ mode, what, value: +value.toFixed(2), min, ok }); if (!ok) failures.push(`${mode}: ${what} = ${value.toFixed(2)} < ${min}`); };
  for (const mode of ['dark', 'light']) {
    const t = TOKENS[mode];
    const surfaces = { ground: t.ground, ...Object.fromEntries(ZONES.map((z) => [`wash-${z}`, wash(mode, z)])) };
    for (const [sn, s] of Object.entries(surfaces)) {
      add(`ink on ${sn}`, contrast(t.ink, s), 7, mode); add(`ink2 on ${sn}`, contrast(t.ink2, s), 4.5, mode);
      for (const z of ZONES) add(`hue ${z} on ${sn}`, contrast(t.hue[z], s), 4.5, mode);
      add(`signal on ${sn}`, contrast(t.signal, s), 4.5, mode);
    }
    const names = [...ZONES, 'signal'], col = (n) => (n === 'signal' ? t.signal : t.hue[n]);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) add(`ΔE ${names[i]}–${names[j]}`, deltaE(col(names[i]), col(names[j])), 30, mode);
  }
  // the hero slab is dark in both modes and carries the dark-mode hues at full strength
  for (const z of ZONES) add(`slab hue ${z}`, contrast(TOKENS.dark.hue[z], TOKENS.dark.slab), 4.5, 'slab');
  add('slab ink', contrast(TOKENS.dark.ink, TOKENS.dark.slab), 7, 'slab');
  return { rows, failures };
}
if (process.argv[1] && process.argv[1].endsWith('tokens.mjs') && !process.argv.includes('--cvd')) { const m = measure(); for (const r of m.rows) console.log(r.ok ? 'ok  ' : 'FAIL', r.mode, r.what, r.value, `(min ${r.min})`); process.exit(m.failures.length ? 1 : 0); }

// Informational: pairwise distance between the category hues and the signal as seen with each colour-vision deficiency
// (Machado et al. 2009, severity 1.0, applied in linear RGB). Meaning never rests on hue alone on this site, so this is a
// report, not a gate: `node _src/tokens.mjs --cvd`.
const CVD = { protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]] };
const toLin = (c) => c.map((v) => lin(v)), fromLin = (v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
export function simulate(hex, kind) {
  const l = toLin(h2(hex)), m = CVD[kind];
  return '#' + m.map((row) => Math.min(255, Math.max(0, fromLin(Math.max(0, Math.min(1, row[0] * l[0] + row[1] * l[1] + row[2] * l[2]))))).toString(16).padStart(2, '0')).join('');
}
export function cvdReport() {
  const out = [];
  for (const mode of ['dark', 'light']) for (const kind of Object.keys(CVD)) {
    const t = TOKENS[mode], names = [...ZONES, 'signal'], col = (n) => simulate(n === 'signal' ? t.signal : t.hue[n], kind);
    let worst = [Infinity, '']; for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) { const d = deltaE(col(names[i]), col(names[j])); if (d < worst[0]) worst = [d, `${names[i]}-${names[j]}`]; }
    out.push({ mode, kind, worst: +worst[0].toFixed(1), pair: worst[1] });
  }
  return out;
}
if (process.argv.includes('--cvd')) for (const r of cvdReport()) console.log(r.mode, r.kind, 'worst pair', r.pair, r.worst);
