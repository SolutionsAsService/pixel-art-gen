// CLI: node _src/render.mjs --kind hero --bits 16 --palette snes --seed ember --scale 8 --out hero.png
import { writeFileSync } from 'node:fs';
import { generate, toRGBA, fingerprint } from './pixelgen.mjs';
import { encodePNG } from './png.mjs';
const a = Object.fromEntries(process.argv.slice(2).reduce((o, v, i, arr) => (v.startsWith('--') ? [...o, [v.slice(2), arr[i + 1]]] : o), []));
const spr = generate({ kind: a.kind || 'creature', bits: +(a.bits || 8), palette: a.palette, seed: a.seed || 'shadw' });
const out = a.out || `${spr.kind}-${spr.seed}.png`;
writeFileSync(out, encodePNG(toRGBA(spr, +(a.scale || 8))));
console.log(JSON.stringify({ out, kind: spr.kind, bits: spr.bits, palette: spr.palette, seed: spr.seed, size: `${spr.w}x${spr.h}`, colours: spr.usedColours.length, fingerprint: fingerprint(spr) }));
