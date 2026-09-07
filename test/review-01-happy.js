/* Reviewer drive 1: first run through every screen, real data, reload, persistence.
   node ../_shiptools/drive.js http://127.0.0.1:8920/index.html test/review-01-happy.js --out test/review-shots */
module.exports = async ({ page, shot, wait, text, click, log, errors }) => {
  const K = 'contact-sheet.v1';
  const fail = m => { throw new Error(m); };

  const before = await page.evaluate(k => localStorage.getItem(k), K);
  if (before !== null) fail('first run was not clean');
  await wait(400);
  await shot('r01-covenant');
  if (await page.evaluate(() => document.getElementById('v-covenant').hidden)) fail('covenant not shown on first run');

  // window.App must exist for the shell.
  const appOk = await page.evaluate(() => typeof window.App === 'object' && typeof window.App.back === 'function');
  log('window.App present:', appOk);
  if (!appOk) fail('window.App missing');

  await click('#covGo');
  await wait(400);
  await shot('r02-shelf');
  const nStocks = await page.evaluate(() => document.querySelectorAll('#shelf button').length);
  log('stocks:', nStocks);
  if (nStocks !== 6) fail('expected 6 stocks, got ' + nStocks);

  // Visit every stock detail screen, front and back of the box.
  for (let i = 0; i < nStocks; i++) {
    await page.evaluate(i => document.querySelectorAll('#shelf button')[i].click(), i);
    await wait(320);
    if (i === 3) { await page.evaluate(() => document.getElementById('stBox').click()); await wait(500); await shot('r03-stock-back'); }
    log('stock', i, await text('#stTitle'), '| curve lines', await page.evaluate(() => document.querySelectorAll('#stCurve .ln').length));
    await page.evaluate(() => window.App.back());
    await wait(220);
  }

  // Load Meridian.
  await page.evaluate(() => document.querySelectorAll('#shelf button')[0].click());
  await wait(350);
  await shot('r04-stock');
  await click('#stLoad');
  await wait(1900);
  await shot('r05-camera-loaded');
  const camState = await page.evaluate(() => Cam.state);
  log('camera:', camState, 'counter', await text('#cNum'));
  if (camState !== 'ready') fail('camera did not open: ' + camState);

  // Shoot 5 frames.
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => document.getElementById('shutterBtn').click());
    if (i === 0) { await wait(300); await shot('r06-windon'); }
    await wait(1500);
  }
  const shotCount = await page.evaluate(() => Store.roll.frames.length);
  log('frames shot:', shotCount, 'counter now', await text('#cNum'));
  if (shotCount !== 5) fail('expected 5 frames, got ' + shotCount);
  await shot('r07-camera-after');

  // No undeveloped frame may be visible.
  const leaked = await page.evaluate(() => Array.from(document.images).filter(i => i.src && i.src.startsWith('blob:') && i.offsetParent).length);
  if (leaked) fail('undeveloped frame on screen');

  // Reload: the roll survives.
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(1200);
  const afterReload = await page.evaluate(() => Store.roll && Store.roll.frames.length);
  log('frames after reload:', afterReload);
  if (afterReload !== 5) fail('roll lost on reload');
  await shot('r08-after-reload');

  // Hand it in.
  await click('#rollBtn');
  await wait(350);
  await shot('r09-rollpanel');
  await click('#rpHand');
  await wait(2600);
  await shot('r10-counter');
  await page.evaluate(() => document.querySelector('#pushSeg button[data-v="-1"]').click());
  await wait(150);
  await click('#rwGo');
  await wait(900);
  await shot('r11-handed');
  log('at lab:', await page.evaluate(() => Store.atLab().length), 'push', await page.evaluate(() => Store.rolls[0].push));

  // Empty camera state.
  await shot('r12-empty-camera');
  if (await page.evaluate(() => document.getElementById('emptyCam').hidden)) fail('empty camera state not shown');

  // Archive with a waiting roll.
  await click('#toSheets');
  await wait(500);
  await shot('r13-sheets-waiting');

  // Empty archive art: check it exists (before any developed roll it is hidden; check markup).
  const artSize = await page.evaluate(() => document.getElementById('sheetsEmptyArt').innerHTML.length);
  log('empty art bytes:', artSize);
  if (artSize < 200) fail('empty state has no drawn art');

  // Wind the clock; develop.
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('contact-sheet.v1'));
    d.rolls[0].developAt = Date.now() - 60000;
    localStorage.setItem('contact-sheet.v1', JSON.stringify(d));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(800);
  await shot('r14-lab');
  await wait(5000);
  await shot('r15-sheet');
  const st = await page.evaluate(() => Store.rolls[0].state);
  log('roll state:', st);
  if (st !== 'developed') fail('roll did not develop: ' + st);
  const keys = await page.evaluate(async () => ({ n: (await DB.keys('neg:')).length, f: (await DB.keys('frm:')).length, t: (await DB.keys('thm:')).length }));
  log('blobs:', JSON.stringify(keys));
  if (keys.n !== 0 || keys.f !== 5 || keys.t !== 5) fail('develop left the wrong blobs: ' + JSON.stringify(keys));

  // The sheet must show 36 cells, 5 real, 31 clear film, and no broken images.
  const cells = await page.evaluate(() => {
    const c = Array.from(document.querySelectorAll('#shGrid .cell'));
    return { total: c.length, unshot: c.filter(x => x.classList.contains('unshot')).length,
             brokenImgs: Array.from(document.querySelectorAll('#shGrid img')).filter(i => !i.getAttribute('src')).length };
  });
  log('sheet cells:', JSON.stringify(cells));
  if (cells.total !== 36 || cells.unshot !== 31 || cells.brokenImgs) fail('sheet grid wrong: ' + JSON.stringify(cells));

  // Loupe.
  const box = await page.evaluate(() => { const c = document.querySelector('#shGrid .cell'); const r = c.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await wait(700);
  await shot('r16-loupe');
  const loupeVis = await page.evaluate(() => !document.getElementById('loupe').hidden);
  await page.mouse.up();
  await wait(200);
  log('loupe shows:', loupeVis);
  if (!loupeVis) fail('loupe did not appear');

  // A frame, keep it.
  await page.evaluate(() => window.App.openFrame(2));
  await wait(900);
  await shot('r17-frame');
  await click('#frKeep');
  await wait(800);
  await shot('r18-kept');
  if (await page.evaluate(() => Store.keepers(Store.rolls[0]).length) !== 1) fail('keeper not recorded');

  await page.evaluate(() => window.App.back());
  await wait(600);
  await shot('r19-sheet-kept');

  // Sheets archive with a developed roll.
  await page.evaluate(() => window.App.back());
  await wait(700);
  await shot('r20-archive');
  const stripImgs = await page.evaluate(() => document.querySelectorAll('#sheetsList .rc-strip img').length);
  log('archive strip images:', stripImgs);

  // Settings.
  await page.evaluate(() => window.App.show('settings'));
  await wait(900);
  await shot('r21-settings');
  log('usage:', await text('#usageLine'));

  // Second tab: everything still there.
  const p2 = await page.browser().newPage();
  await p2.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p2.goto(page.url(), { waitUntil: 'networkidle0' });
  await wait(1500);
  const p2rolls = await p2.evaluate(() => Store.rolls.length);
  const p2keep = await p2.evaluate(() => Store.keepers(Store.rolls[0]).length);
  log('second tab rolls:', p2rolls, 'keepers', p2keep);
  await p2.close();
  if (p2rolls !== 1 || p2keep !== 1) fail('data did not persist to a new tab');

  if (errors.length) fail('page errors: ' + errors.join(' | '));
};
