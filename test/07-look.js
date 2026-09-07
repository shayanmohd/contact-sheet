/* Contact Sheet drive 7: every screen and every state on one populated device, for looking at.
   Run: node ../_shiptools/drive.js http://127.0.0.1:8820/index.html test/07-look.js --out test/shots */
module.exports = async ({ page, shot, wait, click, log, errors }) => {
  await page.evaluate(async () => { localStorage.clear(); await DB.clear(); });
  await page.evaluate(async () => {
    const now = Date.now(), hour = 36e5, day = 864e5;
    const frames = (n, endAt, span, keeps) => {
      const out = [];
      for (let i = 1; i <= n; i++) out.push({ n: i, at: Math.round(endAt - span + span * i / n),
        flash: i % 8 === 0, seed: (i * 104729) % 1e9, keeper: keeps.includes(i) });
      return out;
    };
    const dev = { id: 'd1', no: 12, stock: 'nightbus1600', total: 36, loadedAt: now - 2 * day,
      state: 'developed', push: 1, discreet: true, shared: 21,
      sentAt: now - day, developAt: now - 4 * hour, developedAt: now - 4 * hour,
      frames: frames(36, now - day, 6 * hour, [4, 9, 21, 28, 33]) };
    const dev2 = { id: 'd2', no: 11, stock: 'riviera50', total: 36, loadedAt: now - 9 * day,
      state: 'developed', push: 0, discreet: false, shared: false,
      sentAt: now - 8 * day, developAt: now - 7 * day, developedAt: now - 7 * day,
      frames: frames(24, now - 8 * day, 20 * hour, [6, 17]) };
    const lab = { id: 'l1', no: 13, stock: 'cornerstore400', total: 36, loadedAt: now - 8 * hour,
      state: 'lab', push: 0, discreet: false, shared: false, sentAt: now - hour,
      developAt: now + 9 * hour, frames: frames(36, now - hour, 7 * hour, []) };
    const live = { id: 'c1', no: 14, stock: 'gullwing', total: 36, loadedAt: now - 3 * hour,
      state: 'loaded', push: 0, discreet: false, shared: false, frames: frames(22, now - 12e4, 3 * hour, []) };
    localStorage.setItem('contact-sheet.v1', JSON.stringify({
      onboarded: true, settings: { developHour: 8, sound: 'full', haptics: true, facing: 'environment' },
      roll: live, rolls: [lab, dev, dev2], seq: 14 }));

    // Something photographic in the frames: a scene painted here, then run through the
    // app's own development pipeline so the grain and halation are the real thing.
    const scene = (i) => {
      const c = document.createElement('canvas'); c.width = 400; c.height = 600;
      const g = c.getContext('2d');
      const h = (i * 47) % 360;
      const sky = g.createLinearGradient(0, 0, 0, 600);
      sky.addColorStop(0, `hsl(${(h + 200) % 360},32%,${18 + (i % 5) * 6}%)`);
      sky.addColorStop(0.55, `hsl(${(h + 30) % 360},44%,${44 + (i % 4) * 7}%)`);
      sky.addColorStop(1, `hsl(${h},30%,14%)`);
      g.fillStyle = sky; g.fillRect(0, 0, 400, 600);
      const gl = g.createRadialGradient(120 + (i * 37) % 200, 150 + (i * 23) % 180, 4,
                                        120 + (i * 37) % 200, 150 + (i * 23) % 180, 190);
      gl.addColorStop(0, 'rgba(255,244,214,0.95)'); gl.addColorStop(1, 'rgba(255,244,214,0)');
      g.fillStyle = gl; g.fillRect(0, 0, 400, 600);
      g.fillStyle = 'rgba(14,10,8,0.88)';
      g.beginPath(); g.moveTo(0, 600);
      for (let x = 0; x <= 400; x += 40) g.lineTo(x, 420 + Math.sin((x + i * 31) / 60) * 46);
      g.lineTo(400, 600); g.closePath(); g.fill();
      return c;
    };
    for (const roll of [dev, dev2]) {
      const stock = Stocks.get(roll.stock);
      for (const f of roll.frames) {
        const cv = document.createElement('canvas'); cv.width = 400; cv.height = 600;
        Film.renderTo(cv, scene(f.n + roll.no * 13), stock, { seed: f.seed, frameNo: f.n, push: roll.push });
        const full = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
        const tc = document.createElement('canvas'); tc.width = 200; tc.height = 300;
        tc.getContext('2d').drawImage(cv, 0, 0, 200, 300);
        const thumb = await new Promise(r => tc.toBlob(r, 'image/jpeg', 0.85));
        await DB.put(DB.frmKey(roll.id, f.n), full);
        await DB.put(DB.thmKey(roll.id, f.n), thumb);
      }
    }
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(1600);

  await shot('70-camera');
  await page.evaluate(() => document.getElementById('rollBtn').click());
  await wait(500); await shot('71-rollpanel');
  await page.evaluate(() => App.back()); await wait(300);

  await page.evaluate(() => App.show('sheets')); await wait(1500); await shot('72-sheets');
  await page.evaluate(() => document.querySelectorAll('.rollcard')[1].click());
  await wait(1800); await shot('73-sheet');
  await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const g = document.querySelector('#shGrid');
    const c = g.querySelectorAll('.cell')[20];
    const r = c.querySelector('img').getBoundingClientRect();
    const o = { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true,
                clientX: r.left + r.width * 0.5, clientY: r.top + r.height * 0.5 };
    g.dispatchEvent(new PointerEvent('pointerdown', o)); await w(420);
    g.dispatchEvent(new PointerEvent('pointermove', o)); await w(500);
  });
  await wait(400); await shot('74-loupe');
  await page.evaluate(() => document.querySelector('#shGrid').dispatchEvent(
    new PointerEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: 0, clientY: 0 })));
  await wait(300);
  await page.evaluate(() => App.openFrame(21)); await wait(1000); await shot('75-frame');
  await page.evaluate(() => document.getElementById('shMenu') && App.show('sheet')); await wait(900);
  await page.evaluate(() => document.getElementById('shMenu').click()); await wait(450); await shot('76-sheetmenu');
  await page.evaluate(() => App.back()); await wait(300);

  await page.evaluate(() => App.show('stocks')); await wait(900); await shot('77-shelf');
  await page.evaluate(() => document.querySelectorAll('#shelf button')[5].click()); await wait(700); await shot('78-stock');
  await page.evaluate(() => document.getElementById('stBox').click()); await wait(900); await shot('79-stock-back');
  await page.evaluate(() => App.show('settings')); await wait(1200); await shot('80-settings');
  await page.evaluate(() => { const el = document.querySelector('.scroller'); el.scrollTop = el.scrollHeight; });
  await wait(500); await shot('81-settings-end');

  // the lab, mid batch
  await page.evaluate(() => { App.show('lab');
    document.getElementById('labRoll').textContent = 'Roll 13';
    document.getElementById('labN').textContent = '19 of 36';
    document.getElementById('labFill').style.width = '53%';
    document.getElementById('labSpool').style.setProperty('--turn', '228deg'); });
  await wait(700); await shot('82-lab');

  // the counter, mid rewind and then at the counter
  await page.evaluate(() => { App.show('camera'); document.getElementById('rollBtn').click(); });
  await wait(400);
  await page.evaluate(() => document.getElementById('rpHand').click());
  await wait(600); await shot('83-rewind');
  await wait(2200); await shot('84-counter');
  await page.evaluate(() => document.querySelector('#pushSeg button[data-v="-1"]').click());
  await wait(300); await shot('85-counter-pull');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
