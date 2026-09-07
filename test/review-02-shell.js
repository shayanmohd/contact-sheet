/* Reviewer drive 2: back() on every screen, safe areas at --sat 48 / --sab 34,
   onPause / onResume, the notification schedule. */
module.exports = async ({ page, shot, wait, text, click, log, errors }) => {
  const fail = m => { throw new Error(m); };

  // Seed a device with a developed roll and a roll at the lab, quickly.
  await page.evaluate(() => {
    localStorage.setItem('contact-sheet.v1', JSON.stringify({
      onboarded: true,
      settings: { developHour: 8, sound: 'full', haptics: true, facing: 'environment' },
      roll: null, rolls: [], seq: 0
    }));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(700);

  // Shoot two frames through the real path so there is something to develop.
  await page.evaluate(() => { Store.loadRoll('meridian'); window.App.renderCamera(); window.App.show('camera'); });
  await wait(1400);
  for (let i = 0; i < 2; i++) { await page.evaluate(() => document.getElementById('shutterBtn').click()); await wait(1500); }
  await page.evaluate(() => { const r = Store.sendToLab(); Store.all().rolls[0].developAt = Date.now() - 1000; Store.save(); });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(4500);
  const developed = await page.evaluate(() => Store.developed().length);
  log('developed rolls:', developed);
  if (developed !== 1) fail('setup did not develop');

  // Also leave one roll at the lab, for the waiting card.
  await page.evaluate(() => { Store.loadRoll('nightbus'); Store.recordFrame({}); Store.sendToLab(); });

  const viewOf = () => page.evaluate(() => { const s = document.querySelector('#stage .screen:not([hidden])'); return s ? s.id.slice(2) : null; });

  // ---- back() semantics ----
  const cases = [
    ['sheets', 'camera'], ['stocks', 'camera'], ['settings', 'sheets']
  ];
  for (const [from, to] of cases) {
    await page.evaluate(v => window.App.show(v), from);
    await wait(300);
    const r = await page.evaluate(() => window.App.back());
    const now = await viewOf();
    log(`back from ${from}: returned ${r}, now ${now}`);
    if (r !== true || now !== to) fail(`back from ${from} went to ${now} (${r})`);
  }

  // sheet -> sheets
  await page.evaluate(() => { const r = Store.developed()[0]; window.App.show('sheets'); });
  await wait(500);
  await page.evaluate(() => document.querySelector('#sheetsList .rollcard:not(.waiting)').click());
  await wait(900);
  if (await viewOf() !== 'sheet') fail('did not open the sheet');
  // frame -> sheet
  await page.evaluate(() => window.App.openFrame(1));
  await wait(700);
  if (await viewOf() !== 'frame') fail('did not open the frame');
  let r = await page.evaluate(() => window.App.back()); await wait(300);
  log('back from frame:', r, await viewOf());
  if (r !== true || await viewOf() !== 'sheet') fail('back from frame wrong');
  r = await page.evaluate(() => window.App.back()); await wait(300);
  log('back from sheet:', r, await viewOf());
  if (r !== true || await viewOf() !== 'sheets') fail('back from sheet wrong');
  r = await page.evaluate(() => window.App.back()); await wait(300);
  log('back from sheets:', r, await viewOf());
  if (r !== true || await viewOf() !== 'camera') fail('back from sheets wrong');
  r = await page.evaluate(() => window.App.back()); await wait(200);
  log('back at camera root:', r);
  if (r !== false) fail('back at the root did not return false');

  // stock -> stocks -> camera -> false
  await page.evaluate(() => window.App.show('stocks'));
  await wait(400);
  await page.evaluate(() => document.querySelectorAll('#shelf button')[2].click());
  await wait(500);
  if (await viewOf() !== 'stock') fail('did not open a stock');
  r = await page.evaluate(() => window.App.back()); await wait(250);
  if (r !== true || await viewOf() !== 'stocks') fail('back from stock wrong');
  r = await page.evaluate(() => window.App.back()); await wait(250);
  if (r !== true || await viewOf() !== 'camera') fail('back from stocks wrong');
  r = await page.evaluate(() => window.App.back());
  if (r !== false) fail('root back true after wandering');
  log('back from stock chain ok');

  // Modal back consumes, does not navigate.
  await page.evaluate(() => window.App.show('camera'));
  await wait(300);
  await page.evaluate(() => { Store.loadRoll('meridian'); window.App.renderCamera(); });
  await wait(200);
  await click('#rollBtn'); await wait(350);
  r = await page.evaluate(() => window.App.back()); await wait(200);
  const modalStillOpen = await page.evaluate(() => !document.getElementById('rollPanel').hidden);
  log('back closed the modal:', r, 'modal open:', modalStillOpen);
  if (r !== true || modalStillOpen) fail('modal back wrong');

  // Deep wander then back N times must reach false in at most 8 presses.
  await page.evaluate(() => { window.App.show('sheets'); });
  await wait(200);
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.App.show('stocks')); await wait(80);
    await page.evaluate(() => window.App.show('sheets')); await wait(80);
  }
  let presses = 0, res = true;
  while (res && presses < 10) { res = await page.evaluate(() => window.App.back()); presses++; await wait(60); }
  log('presses to leave after wandering:', presses, 'final', res);
  if (res !== false || presses > 3) fail('back did not leave the app promptly: ' + presses);

  // ---- onPause / onResume ----
  const pr = await page.evaluate(async () => {
    try { window.App.onPause(); await window.App.onResume(); return 'ok'; } catch (e) { return 'threw: ' + e.message; }
  });
  log('onPause/onResume:', pr);
  if (pr !== 'ok') fail(pr);
  await wait(600);

  // ---- notification schedule ----
  const notif = await page.evaluate(() => {
    const n = Store.notifications();
    return { count: n.length, ids: n.map(x => x.id), past: n.filter(x => x.at <= Date.now()).length,
             sample: n[0] };
  });
  log('notifications:', JSON.stringify(notif));
  if (notif.past) fail('a notification is scheduled in the past');
  if (new Set(notif.ids).size !== notif.ids.length) fail('duplicate notification ids');

  // 90 rolls at the lab: cap and uniqueness.
  const cap = await page.evaluate(() => {
    const d = Store.all();
    const base = Date.now() + 3600e3;
    for (let i = 0; i < 90; i++) d.rolls.push({ id: 'x' + i, no: i + 50, stock: 'meridian', total: 36,
      loadedAt: base, state: 'lab', push: 0, discreet: false, shared: false,
      frames: [{ n: 1, at: base, flash: false, seed: 1, keeper: false }], sentAt: base, developAt: base + i * 86400e3 });
    const n = Store.notifications();
    return { count: n.length, unique: new Set(n.map(x => x.id)).size, past: n.filter(x => x.at <= Date.now()).length };
  });
  log('with 90 rolls at the lab:', JSON.stringify(cap));
  if (cap.count > 64) fail('notification schedule exceeds 64');
  if (cap.unique !== cap.count) fail('notification ids collide');
  await page.evaluate(() => location.reload());
  await wait(1200);

  // ---- safe areas ----
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--sat', '48px');
    document.documentElement.style.setProperty('--sab', '34px');
  });
  await wait(400);
  const SAT = 48, SAB = 34;
  const screens = ['camera', 'sheets', 'sheet', 'frame', 'stocks', 'stock', 'settings'];
  for (const v of screens) {
    if (v === 'sheet') { await page.evaluate(() => { window.App.show('sheets'); }); await wait(400);
      await page.evaluate(() => document.querySelector('#sheetsList .rollcard:not(.waiting)').click()); await wait(900); }
    else if (v === 'frame') { await page.evaluate(() => window.App.openFrame(1)); await wait(800); }
    else if (v === 'stock') { await page.evaluate(() => { window.App.show('stocks'); }); await wait(300);
      await page.evaluate(() => document.querySelectorAll('#shelf button')[0].click()); await wait(500); }
    else { await page.evaluate(x => window.App.show(x), v); await wait(600); }
    // Two passes. At rest nothing may sit under either bar. Scrolled to the end, the
    // bottom padding must still clear the navigation bar; the top is only checked at
    // rest, because content passing behind an opaque top bar is what scrolling looks like.
    const measure = ({ sat, sab, topToo, bottomToo }) => {
      const H = window.innerHeight;
      const out = [];
      const vis = el => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05; };
      document.querySelectorAll('#stage .screen:not([hidden]) *, .modal:not([hidden]) *, .sheetbar, .framebar').forEach(el => {
        if (!vis(el)) return;
        const leafText = el.children.length === 0 && el.textContent.trim().length > 0;
        const control = el.matches('button, input, select, img, canvas, svg');
        if (!leafText && !control) return;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        if (r.bottom <= 0 || r.top >= H) return;
        if (topToo && r.top < sat - 0.5) out.push({ tag: el.tagName + '.' + el.className, top: Math.round(r.top), where: 'status' });
        if (bottomToo && r.bottom > H - sab + 0.5) out.push({ tag: el.tagName + '.' + el.className, bottom: Math.round(r.bottom), H, where: 'nav' });
      });
      const seen = new Set(); return out.filter(o => { const k = o.tag + o.where; if (seen.has(k)) return false; seen.add(k); return true; });
    };
    await shot('safe-' + v);
    const rest = await page.evaluate(measure, { sat: SAT, sab: SAB, topToo: true, bottomToo: false });
    await page.evaluate(() => document.querySelectorAll('#stage .screen:not([hidden]) .scroller, #stage .screen:not([hidden]) .pad')
      .forEach(sc => { sc.scrollTop = sc.scrollHeight; }));
    await wait(400);
    await shot('safe-' + v + '-end');
    const end2 = await page.evaluate(measure, { sat: SAT, sab: SAB, topToo: false, bottomToo: true });
    const bad = rest.concat(end2);
    log('safe area', v, bad.length ? JSON.stringify(bad).slice(0, 600) : 'clean');
    if (bad.length) fail('content under a system bar on ' + v);
  }

  // The loupe with insets, at the top and the bottom of the grid.
  await page.evaluate(() => { window.App.show('sheets'); });
  await wait(400);
  await page.evaluate(() => document.querySelector('#sheetsList .rollcard:not(.waiting)').click());
  await wait(900);
  // Only a shot frame carries the loupe, so cell 1 is driven to the very top of the
  // grid area and then to the very bottom, and measured against both insets.
  for (const which of ['top', 'bottom']) {
    // Only a shot frame carries the loupe and this roll has two, so the grid is pushed
    // down to drive frame 1 to the bottom of the viewport rather than shooting 36.
    const p = await page.evaluate(w => {
      const sc = document.getElementById('shScroll');
      const g = document.getElementById('shGrid');
      g.style.marginTop = w === 'top' ? '0px' : '640px';
      const c = document.querySelector('#shGrid .cell');
      const want = w === 'top' ? 60 : window.innerHeight - 130;   // the sheet bar owns the last 98px
      sc.scrollTop = 0;
      const r0 = c.getBoundingClientRect();
      sc.scrollTop += (r0.top + r0.height / 2) - want;
      const r = c.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, which);
    await wait(350);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await wait(500);
    await page.mouse.move(p.x + 2, p.y);
    await wait(300);
    await shot('loupe-' + which);
    const lb = await page.evaluate(() => { const l = document.getElementById('loupe'); const r = l.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, H: window.innerHeight, hidden: l.hidden }; });
    await page.mouse.up();
    await wait(250);
    log('loupe', which, 'pressed at y=' + Math.round(p.y), JSON.stringify(lb));
    if (lb.hidden) fail('the loupe did not appear at the ' + which);
    if (lb.top < SAT - 0.5 || lb.bottom > lb.H - SAB + 0.5) fail('loupe under a system bar at the ' + which);
  }
  await page.evaluate(() => { document.getElementById('shGrid').style.marginTop = ''; });

  // The three modals, the lab and the covenant carry insets too.
  const clear = async (label) => {
    const bad = await page.evaluate(({ sat, sab }) => {
      const H = window.innerHeight, out = [];
      const vis = el => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05; };
      document.querySelectorAll('#stage .screen:not([hidden]) *, .modal:not([hidden]) *').forEach(el => {
        if (!vis(el)) return;
        const leafText = el.children.length === 0 && el.textContent.trim().length > 0;
        if (!leafText && !el.matches('button, input, select, img, canvas, svg')) return;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.bottom <= 0 || r.top >= H) return;
        if (r.top < sat - 0.5) out.push(el.tagName + '.' + el.className + ' top ' + Math.round(r.top));
        if (r.bottom > H - sab + 0.5) out.push(el.tagName + '.' + el.className + ' bottom ' + Math.round(r.bottom));
      });
      return Array.from(new Set(out));
    }, { sat: SAT, sab: SAB });
    log('safe area', label, bad.length ? JSON.stringify(bad) : 'clean');
    if (bad.length) fail('content under a system bar on ' + label);
  };

  await page.evaluate(() => { Store.loadRoll('riviera'); Store.recordFrame({}); window.App.show('camera'); document.getElementById('rollBtn').click(); });
  await wait(400); await shot('safe-rollpanel'); await clear('roll panel');
  await page.evaluate(() => document.getElementById('rpHand').click());
  await wait(2600); await shot('safe-rewind'); await clear('rewind sheet');
  await page.evaluate(() => window.App.back());
  await wait(300);
  await page.evaluate(() => { window.App.show('sheets'); });
  await wait(500);
  await page.evaluate(() => document.querySelector('#sheetsList .rollcard:not(.waiting)').click());
  await wait(900);
  await page.evaluate(() => document.getElementById('shMenu').click());
  await wait(400); await shot('safe-sheetmenu'); await clear('sheet menu');
  await page.evaluate(() => window.App.back());
  await wait(300);
  await page.evaluate(() => window.App.show('lab'));
  await wait(500); await shot('safe-lab'); await clear('lab');
  await page.evaluate(() => { Store.onboarded(false); window.App.show('covenant'); });
  await wait(600); await shot('safe-covenant'); await clear('covenant');
  await page.evaluate(() => Store.onboarded(true));

  // The two drawn states of the camera itself, which lay out differently from the viewfinder.
  await page.evaluate(() => { Store.unload(); window.App.show('camera'); window.App.renderCamera(); });
  await wait(800); await shot('safe-camera-empty'); await clear('camera empty');
  await page.evaluate(() => { Store.loadRoll('gullwing'); for (let i = 0; i < 36; i++) Store.recordFrame({});
                              window.App.show('camera'); window.App.renderCamera(); });
  await wait(900); await shot('safe-camera-finished'); await clear('camera finished');

  if (errors.length) fail('page errors: ' + errors.join(' | '));
};
