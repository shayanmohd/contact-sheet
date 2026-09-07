/* Reviewer drive 4: WCAG AA measured off the rendered pixels, not off computed styles,
   so gradients, opacity, the film boxes and the accent button are all measured as drawn.
   For every screen it shoots the page twice, once normally and once with every glyph made
   transparent. The difference between the two is the ink; the second shot is the ground. */
module.exports = async ({ page, shot, wait, text, click, log, errors }) => {
  const fail = m => { throw new Error(m); };

  await page.evaluate(() => {
    localStorage.setItem('contact-sheet.v1', JSON.stringify({
      onboarded: true, settings: { developHour: 8, sound: 'full', haptics: true, facing: 'environment' },
      roll: null, rolls: [], seq: 0 }));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(700);
  await page.evaluate(() => { Store.loadRoll('meridian100'); window.App.show('camera'); });
  await wait(1400);
  for (let i = 0; i < 3; i++) { await page.evaluate(() => document.getElementById('shutterBtn').click()); await wait(1500); }
  await page.evaluate(() => { Store.sendToLab(); Store.all().rolls[0].developAt = Date.now() - 1000; Store.save(); });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(5000);
  await page.evaluate(() => { Store.toggleKeeper(Store.rolls[0].id, 2); Store.loadRoll('cornerstore400'); Store.recordFrame({}); Store.sendToLab(); });

  await page.addStyleTag({ content: '#hidetext-on * { color: transparent !important; -webkit-text-fill-color: transparent !important; }' });

  const cand = async () => page.evaluate(() => {
    const out = [];
    const modal = document.querySelector('.modal:not([hidden])');
    // A modal dims the screen behind it on purpose, so only the modal is measured while one is open.
    const roots = modal ? [modal]
      : [document.querySelector('#stage .screen:not([hidden])'),
         document.querySelector('.sheetbar'), document.querySelector('.framebar')].filter(Boolean);
    let i = 0;
    for (const root of roots) {
      root.querySelectorAll('*').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        if (!Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())) return;
        const r = el.getBoundingClientRect();
        if (r.width < 6 || r.height < 6 || r.top < 0 || r.bottom > window.innerHeight) return;
        // the box turns over: only the face pointing at you is painted
        const box3d = el.closest('.box3d');
        if (box3d) {
          const face = el.closest('.face');
          const flipped = box3d.classList.contains('flip');
          if (face && (face.classList.contains('back') !== flipped)) return;
        }
        let op = 1, n = el;
        while (n && n !== document.documentElement) { op *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
        if (op < 0.08) return;
        const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
        const m = cs.color.match(/rgba?\(([^)]+)\)/);
        if (!m) return;
        const c = m[1].split(',').map(Number);
        out.push({ i: i++, sel: el.tagName + '.' + (el.className || '').toString().slice(0, 30),
                   t: el.textContent.trim().slice(0, 30).replace(/\s+/g, ' '),
                   x: r.x, y: r.y, w: r.width, h: r.height, size, bold,
                   ink: [c[0], c[1], c[2]], alpha: (c.length > 3 ? c[3] : 1) * op,
                   large: size >= 24 || (size >= 18.66 && bold) });
      });
    }
    return out;
  });

  const png = async () => (await page.screenshot({ encoding: 'base64' }));

  const measure = async (label) => {
    const items = await cand();
    if (!items.length) { log(label, ': nothing to measure'); return []; }
    const withText = await png();
    await page.evaluate(() => document.documentElement.id = 'hidetext-on');
    await wait(160);
    const noText = await png();
    await page.evaluate(() => document.documentElement.id = '');
    await wait(120);
    return page.evaluate(async ({ items, a, b, dpr }) => {
      const load = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + src; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const ca = document.createElement('canvas'); ca.width = ia.width; ca.height = ia.height;
      ca.getContext('2d').drawImage(ia, 0, 0);
      const cb = document.createElement('canvas'); cb.width = ib.width; cb.height = ib.height;
      cb.getContext('2d').drawImage(ib, 0, 0);
      const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const ratio = (p, q) => { const l1 = lum(p), l2 = lum(q); const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
        return (hi + 0.05) / (lo + 0.05); };
      const out = [];
      for (const it of items) {
        const X = Math.round(it.x * dpr), Y = Math.round(it.y * dpr);
        const W = Math.max(1, Math.round(it.w * dpr)), H = Math.max(1, Math.round(it.h * dpr));
        if (X < 0 || Y < 0 || X + W > ca.width || Y + H > ca.height) continue;
        const da = ca.getContext('2d').getImageData(X, Y, W, H).data;
        const db = cb.getContext('2d').getImageData(X, Y, W, H).data;
        let best = -1, fg = null, bg = null;
        for (let p = 0; p < da.length; p += 4) {
          const d = Math.abs(da[p] - db[p]) + Math.abs(da[p + 1] - db[p + 1]) + Math.abs(da[p + 2] - db[p + 2]);
          if (d > best) { best = d; fg = [da[p], da[p + 1], da[p + 2]]; bg = [db[p], db[p + 1], db[p + 2]]; }
        }
        if (!fg || best < 24) continue;      // no glyph found in the box
        // The ground comes off the pixels, so gradients and images are honest. The ink is
        // the specified colour composited at its own opacity, because WCAG is defined on
        // the colours asked for, not on how far antialiasing got at 8px.
        const ink = [0, 1, 2].map(k => it.ink[k] * it.alpha + bg[k] * (1 - it.alpha));
        const r = ratio(ink, bg);
        out.push({ sel: it.sel, t: it.t, size: it.size, large: it.large,
                   fg: 'rgb(' + ink.map(Math.round).join(',') + ')', bg: 'rgb(' + bg.join(',') + ')',
                   ratio: +r.toFixed(2), need: it.large ? 3 : 4.5, ok: r >= (it.large ? 3 : 4.5) });
      }
      return out;
    }, { items, a: withText, b: noText, dpr: 2 });
  };

  const bad = [];
  const go = async (label) => {
    const rows = await measure(label);
    const b = rows.filter(r => !r.ok);
    log(label, ':', rows.length, 'measured,', b.length, 'below AA');
    b.forEach(x => { log('   ', JSON.stringify(x)); bad.push(Object.assign({ screen: label }, x)); });
  };

  await page.evaluate(() => window.App.show('covenant')); await wait(700); await go('covenant');
  await page.evaluate(() => { Store.onboarded(true); window.App.show('camera'); }); await wait(1200); await go('camera');
  await page.evaluate(() => { Store.unload(); window.App.renderCamera(); window.App.show('camera'); }); await wait(900); await go('camera empty');
  await page.evaluate(() => window.App.show('sheets')); await wait(900); await go('sheets');
  await page.evaluate(() => document.querySelector('#sheetsList .rollcard:not(.waiting)').click()); await wait(1400); await go('sheet');
  await page.evaluate(() => window.App.openFrame(2)); await wait(1000); await go('frame');
  await page.evaluate(() => window.App.show('stocks')); await wait(900); await go('stocks');
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.App.show('stocks')); await wait(350);
    await page.evaluate(n => document.querySelectorAll('#shelf button')[n].click(), i);
    await wait(700);
    const nm = await text('#stTitle');
    await go('stock front ' + nm);
    await page.evaluate(() => document.getElementById('stBox').click());
    await wait(900);
    await shot('c-box-' + i);
    await go('stock back ' + nm);
  }
  await page.evaluate(() => window.App.show('settings')); await wait(1200); await go('settings');
  await page.evaluate(() => window.App.show('lab')); await wait(700); await go('lab');
  await page.evaluate(() => { window.App.show('camera'); Store.loadRoll('riviera50'); Store.recordFrame({}); window.App.renderCamera(); document.getElementById('rollBtn').click(); });
  await wait(700); await go('roll panel');
  await page.evaluate(() => document.getElementById('rpHand').click());
  await wait(2800); await go('rewind sheet');

  log('TOTAL below AA:', bad.length);
  if (bad.length) fail(bad.length + ' rendered text pairs below WCAG AA');
  if (errors.length) fail('page errors: ' + errors.join(' | '));
};
