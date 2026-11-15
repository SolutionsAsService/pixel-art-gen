import { generate, toRGBA, packSheet, colourName, KINDS, PALETTES, paletteColourCount } from './pixelgen.js';

const $ = (s, r = document) => r.querySelector(s);
const page = document.body.dataset.page;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const fillPalettes = (sel, bits, cur) => {
  sel.innerHTML = '';
  for (const [id, p] of Object.entries(PALETTES)) if (p.bits === bits) { const o = new Option(`${p.label}, ${paletteColourCount(id).toLocaleString('en')} colours`, id); sel.add(o); }
  sel.value = PALETTES[cur]?.bits === bits ? cur : sel.options[0].value;
};
const draw = (canvas, spr, max) => {
  const img = toRGBA(spr, 1); canvas.width = spr.w; canvas.height = spr.h;
  canvas.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
  const k = Math.max(1, Math.floor(max / spr.w)); canvas.style.width = `${spr.w * k}px`; canvas.style.height = `${spr.h * k}px`;
};
const png = (img, name) => {
  const c = document.createElement('canvas'); c.width = img.w; c.height = img.h;
  c.getContext('2d').putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
  c.toBlob((b) => save(b, name), 'image/png');
};
const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const code = (r) => Array.from({ length: 6 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(r() * 36)]).join('');
const rnd = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return (a[0] / 4294967296); };

if (page === 'studio') {
  const q = new URLSearchParams(location.search);
  const st = { kind: KINDS[q.get('kind')] ? q.get('kind') : 'creature', bits: q.get('bits') === '16' ? 16 : 8, palette: q.get('palette') || '', seed: (q.get('seed') || 'ember').slice(0, 40) };
  const form = $('#controls'), pal = $('#palette'), seed = $('#seed'), main = $('#preview'), status = $('#status');
  const say = (t) => { status.textContent = t; };
  let vbase = null;
  const render = (updateUrl = true, keepVariants = false) => {
    fillPalettes(pal, st.bits, pal.value || st.palette); st.palette = pal.value;
    form.elements.kind.value = st.kind; form.elements.bits.value = String(st.bits); seed.value = st.seed;
    const spr = generate(st); draw(main, spr, Math.min(384, $('.frame').clientWidth - 24));
    main.setAttribute('aria-label', `${spr.alt} ${PALETTES[st.palette].label} palette, seed ${st.seed}.`); $('#desc').textContent = spr.alt;
    const limit = st.kind === 'island' ? '. An island is a background, so it is not held to the sprite limit' : st.bits === 8 ? `, limit ${st.palette === 'gb' ? 4 : 3} plus transparent` : ', limit 15 plus transparent';
    $('#readout').textContent = `${spr.w} by ${spr.h} pixels, ${spr.usedColours.length} colours used${limit}.`;
    $('#swatches').innerHTML = spr.usedColours.map((c) => { const n = colourName([1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))); return `<li><i style="background:${c}"></i><span>${n}</span> <code>${c}</code></li>`; }).join('');
    const grid = $('#variants');
    if (keepVariants && grid.children.length) { for (const b of grid.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.seed === st.seed)); if (updateUrl) url(); return; }
    grid.innerHTML = ''; vbase = st.seed;
    const seedsRand = (() => { let h = 0; for (const ch of vbase + '#v') h = (h * 31 + ch.charCodeAt(0)) >>> 0; let a = h; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
    for (let i = 0; i < 12; i++) {
      const s = code(seedsRand), v = generate({ ...st, seed: s }), li = document.createElement('li'), b = document.createElement('button'), c = document.createElement('canvas');
      b.type = 'button'; b.dataset.seed = s; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', `Use seed ${s}: ${v.alt}`); draw(c, v, 88); b.append(c, Object.assign(document.createElement('span'), { textContent: s })); b.onclick = () => { st.seed = s; render(true, true); main.scrollIntoView({ block: 'nearest' }); say(`Seed ${s} selected. ${generate({ ...st, seed: s }).alt}`); };
      li.append(b); grid.append(li);
    }
    if (updateUrl) url();
  };
  const url = () => { const u = new URLSearchParams({ kind: st.kind, bits: st.bits, palette: st.palette, seed: st.seed }); history.replaceState(null, '', `?${u}`); };
  form.addEventListener('change', (e) => {
    if (e.target.name === 'kind') st.kind = e.target.value;
    if (e.target.name === 'bits') { st.bits = +e.target.value; pal.value = ''; }
    if (e.target.id === 'palette') st.palette = pal.value;
    render();
  });
  let deb; seed.addEventListener('input', () => { st.seed = seed.value.trim() || 'ember'; clearTimeout(deb); deb = setTimeout(() => render(), 250); });
  $('#reroll').onclick = () => { st.seed = code(rnd); render(); say(`Seed ${st.seed}.`); };
  $('#dl').onclick = () => { const k = +$('#scale').value; png(toRGBA(generate(st), k), `${st.kind}-${st.bits}bit-${st.palette}-${st.seed}-x${k}.png`); say('PNG downloaded.'); };
  $('#copy').onclick = async () => { try { await navigator.clipboard.writeText(location.href); say('Link copied.'); } catch { say('Copy failed. The address bar holds the link.'); } };
  $('#add').onclick = () => { const l = store.get('pixelgen.picks', []); l.push({ kind: st.kind, bits: st.bits, palette: st.palette, seed: st.seed }); say(store.set('pixelgen.picks', l.slice(-64)) ? `Added. ${Math.min(l.length, 64)} in your sheet.` : 'This browser blocks saving, so the sheet cannot keep picks.'); };
  addEventListener('resize', () => render(false));
  render();
}

if (page === 'sheets') {
  const f = { kind: $('#s-kind'), bits: $('#s-bits'), pal: $('#s-palette'), seed: $('#s-seed'), count: $('#s-count'), cols: $('#s-cols'), scale: $('#s-scale') };
  const cv = $('#sheet'), status = $('#s-status'); let current = null;
  const say = (t) => { status.textContent = t; };
  const picksN = () => $('#pickn').textContent = String(store.get('pixelgen.picks', []).length);
  const show = (sprites) => {
    const k = +f.scale.value, sheet = packSheet(sprites, { columns: Math.min(+f.cols.value, sprites.length), scale: 1, pad: 1 });
    cv.width = sheet.w; cv.height = sheet.h; cv.getContext('2d').putImageData(new ImageData(sheet.data, sheet.w, sheet.h), 0, 0);
    const z = Math.max(1, Math.floor(Math.min(960, document.documentElement.clientWidth - 56) / sheet.w)); cv.style.width = `${sheet.w * z}px`; cv.style.height = `${sheet.h * z}px`;
    current = { sprites, k }; $('#s-readout').textContent = `${sprites.length} sprites, ${sheet.w} by ${sheet.h} pixels at 1x.`;
  };
  const sync = () => { fillPalettes(f.pal, +f.bits.value, f.pal.value); };
  const make = () => { const n = +f.count.value, out = []; for (let i = 0; i < n; i++) out.push(generate({ kind: f.kind.value, bits: +f.bits.value, palette: f.pal.value, seed: `${f.seed.value.trim() || 'ember'}-${i + 1}` })); show(out); say(''); };
  f.bits.onchange = () => { sync(); make(); };
  for (const el of [f.kind, f.pal, f.count, f.cols, f.scale]) el.onchange = make;
  f.seed.oninput = make; $('#s-make').onclick = make;
  $('#s-picks').onclick = () => { const l = store.get('pixelgen.picks', []); if (!l.length) { say('No picks yet. Use “Add to sheet” in the Studio.'); return; } show(l.map(generate)); say(`Showing ${l.length} Studio picks.`); };
  $('#s-clear').onclick = () => { store.set('pixelgen.picks', []); picksN(); say('Picks cleared.'); };
  $('#s-png').onclick = () => { if (!current) return; const s = packSheet(current.sprites, { columns: Math.min(+f.cols.value, current.sprites.length), scale: +f.scale.value, pad: 1 }); png(s, 'sheet.png'); say('sheet.png downloaded.'); };
  $('#s-json').onclick = () => { if (!current) return; const s = packSheet(current.sprites, { columns: Math.min(+f.cols.value, current.sprites.length), scale: +f.scale.value, pad: 1 }); save(new Blob([JSON.stringify(s.atlas, null, 2)], { type: 'application/json' }), 'sheet.json'); say('sheet.json downloaded.'); };
  sync(); picksN(); make();
}
