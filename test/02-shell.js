/* Contact Sheet drive 2: the shell contract. Persistence across a reload and a fresh tab,
   window.App.back() on every nested screen, onPause / onResume, and the safe-area insets.
   Run: node ../_shiptools/drive.js http://127.0.0.1:8820/index.html test/02-shell.js --out test/shots */
const K = 'contact-sheet.v1';

module.exports = async ({ page, shot, wait, text, click, log, errors, browser }) => {
  // Build a believable device: one developed roll, one at the lab, one in the camera.
  await page.evaluate(async () => {
    const now = Date.now(), hour = 36e5, day = 864e5;
    const frames = (n, endAt, span, keeps) => {
      const out = [];
      for (let i = 1; i <= n; i++) out.push({ n: i, at: Math.round(endAt - span + span * i / n),
        flash: false, seed: (i * 7919) % 1e6, keeper: keeps.includes(i) });
      return out;
    };
    const dev = { id: 'r1', no: 1, stock: 'meridian100', total: 36, loadedAt: now - 3 * day,
      state: 'developed', push: 0, discreet: false, shared: false,
      sentAt: now - 2 * day, developAt: now - day, developedAt: now - day + 6e4,
      frames: frames(36, now - 2 * day, 5 * hour, [2, 5]) };
    const lab = { id: 'r2', no: 2, stock: 'gullwing', total: 36, loadedAt: now - day,
      state: 'lab', push: 1, discreet: true, shared: false,
      sentAt: now - 2 * hour, developAt: now + 6 * hour,
      frames: frames(36, now - 2 * hour, 6 * hour, []) };
    const live = { id: 'r3', no: 3, stock: 'nightbus1600', total: 36, loadedAt: now - hour,
      state: 'loaded', push: 0, discreet: false, shared: false, frames: frames(9, now, hour, []) };
    localStorage.setItem('contact-sheet.v1', JSON.stringify({
      onboarded: true, settings: { developHour: 8, sound: 'full', haptics: true, facing: 'environment' },
      roll: live, rolls: [lab, dev], seq: 3 }));
    // real developed pixels for r1 so the sheet is not empty
    const cv = document.createElement('canvas'); cv.width = 240; cv.height = 360;
    const g = cv.getContext('2d');
    for (const f of dev.frames) {
      g.fillStyle = '#7a6a4e'; g.fillRect(0, 0, 240, 360);
      g.fillStyle = '#d8c9a4'; g.fillRect(30, 40 + f.n * 4, 170, 200);
      const b = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85));
      await DB.put(DB.frmKey('r1', f.n), b);
      await DB.put(DB.thmKey('r1', f.n), b);
    }
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(900);

  // ---- persistence across a reload ----
  log('after reload, roll in camera:', await page.evaluate(() => Store.roll && Store.roll.frames.length + ' frames'));
  log('rolls stored:', await page.evaluate(() => Store.rolls.length));

  // ---- safe areas on every screen ----
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--sat', '48px');
    document.documentElement.style.setProperty('--sab', '34px');
  });
  await wait(400);
  await shot('20-safe-camera');
  const screens = [['sheets', '21-safe-sheets'], ['stocks', '22-safe-stocks'], ['settings', '23-safe-settings']];
  for (const [v, name] of screens) { await page.evaluate(s => App.show(s), v); await wait(600); await shot(name); }
  await page.evaluate(() => { App.show('sheets'); });
  await wait(600);
  await page.evaluate(() => document.querySelectorAll('.rollcard')[1].click());
  await wait(1200);
  await shot('24-safe-sheet');
  await page.evaluate(() => App.openFrame(2));
  await wait(700);
  await shot('25-safe-frame');

  // Anything under the bars?
  const under = await page.evaluate(() => {
    const sat = 48, sab = 34, out = [];
    const seen = document.querySelectorAll('#stage .screen:not([hidden]) *, .modal:not([hidden]) *, #toast:not([hidden])');
    for (const el of seen) {
      if (!el.offsetParent && el.tagName !== 'BODY') continue;
      const t = (el.innerText || '').trim();
      if (!t || el.children.length) continue;
      const r = el.getBoundingClientRect();
      if (r.height === 0) continue;
      if (r.top < sat) out.push(['top', el.className || el.tagName, Math.round(r.top), t.slice(0, 28)]);
      if (r.bottom > window.innerHeight - sab) out.push(['bottom', el.className || el.tagName, Math.round(r.bottom), t.slice(0, 28)]);
    }
    return out;
  });
  log('text under the bars on the frame screen:', JSON.stringify(under));

  // ---- the loupe is fixed, so it has to clamp itself out from under both bars ----
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--sat', '48px');
    document.documentElement.style.setProperty('--sab', '34px');
  });
  await page.evaluate(() => { App.show('sheets'); });
  await wait(700);
  await page.evaluate(() => document.querySelectorAll('.rollcard')[1].click());
  await wait(1300);
  const loupeBox = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const g = document.querySelector('#shGrid');
    const cells = g.querySelectorAll('.cell');
    const out = [];
    for (const idx of [1, cells.length - 2]) {
      const img = cells[idx].querySelector('img.im');
      if (!img) continue;
      const r = img.getBoundingClientRect();
      const o = { pointerId: 9, pointerType: 'touch', isPrimary: true, bubbles: true,
                  clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
      g.dispatchEvent(new PointerEvent('pointerdown', o)); await w(300);
      g.dispatchEvent(new PointerEvent('pointermove', o)); await w(200);
      const b = document.getElementById('loupe').getBoundingClientRect();
      out.push({ top: Math.round(b.top), bottom: Math.round(b.bottom) });
      g.dispatchEvent(new PointerEvent('pointerup', o)); await w(200);
    }
    return out;
  });
  log('loupe box at the top and bottom of the grid:', JSON.stringify(loupeBox));
  for (const b of loupeBox) {
    if (b.top < 48) throw new Error('the loupe sits under the status bar: ' + JSON.stringify(b));
    if (b.bottom > 844 - 34) throw new Error('the loupe sits under the navigation bar: ' + JSON.stringify(b));
  }
  await shot('26-safe-loupe');

  // ---- back() on every nested screen ----
  await page.evaluate(() => { document.documentElement.style.removeProperty('--sat'); document.documentElement.style.removeProperty('--sab'); });
  const backChain = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const cur = () => document.querySelector('#stage .screen:not([hidden])').id;
    const out = [];
    App.show('sheets'); await w(300);
    document.querySelectorAll('.rollcard')[1].click(); await w(900);
    await App.openFrame(2); await w(400);
    for (let i = 0; i < 6; i++) { const from = cur(); const r = App.back(); await w(300); out.push([from, r, cur()]); }
    return out;
  });
  log('back chain:', JSON.stringify(backChain));
  const rootBack = backChain[backChain.length - 1];
  if (rootBack[2] !== 'v-camera' || rootBack[1] !== false) throw new Error('back() at the root did not return false: ' + JSON.stringify(rootBack));

  // back() closes a modal first
  const modalBack = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    document.getElementById('rollBtn').click(); await w(300);
    const open = !document.getElementById('rollPanel').hidden;
    const r = App.back(); await w(200);
    return [open, r, document.getElementById('rollPanel').hidden];
  });
  log('modal back [open, returned, closed]:', JSON.stringify(modalBack));
  if (!modalBack[1] || !modalBack[2]) throw new Error('back() did not close the modal');

  // ---- onPause / onResume ----
  const life = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    App.show('camera'); await w(900);
    const before = Cam.state;
    App.onPause(); await w(300);
    const paused = Cam.state;
    await App.onResume(); await w(1200);
    return { before, paused, resumed: Cam.state };
  });
  log('camera through pause and resume:', JSON.stringify(life));
  if (life.paused === 'ready') throw new Error('onPause left the camera running');
  if (life.resumed !== 'ready') throw new Error('onResume did not restart the camera');

  // onPause while the wind-on is running must not leave the shutter stuck
  const stuck = await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    document.getElementById('shutterBtn').click();
    await w(300); App.onPause(); await w(400); await App.onResume(); await w(2000);
    return { disabled: document.getElementById('shutterBtn').disabled, state: Cam.state };
  });
  log('shutter after pause mid wind-on:', JSON.stringify(stuck));

  // ---- a fresh tab sees the same device ----
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p2.goto(page.url(), { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  const fresh = await p2.evaluate(async () => ({
    rolls: Store.rolls.length,
    live: Store.roll ? Store.roll.frames.length : null,
    frames: (await DB.keys('frm:')).length
  }));
  log('fresh tab sees:', JSON.stringify(fresh));
  await p2.close();
  if (fresh.rolls !== 2 || fresh.frames < 36) throw new Error('a fresh tab lost data');

  // ---- notifications the shell would schedule ----
  const notes = await page.evaluate(() => Store.notifications());
  log('notifications:', JSON.stringify(notes));
  if (notes.length > 64) throw new Error('more than 64 notifications');
  if (notes.some(n => n.at <= Date.now())) throw new Error('a notification is scheduled in the past');
  if (new Set(notes.map(n => n.id)).size !== notes.length) throw new Error('notification ids collide');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
