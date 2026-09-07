/* Reviewer drive 3: a device that was on 1.0.0 opens 1.0.1.
   The seed is written by hand in the exact shape `git show 75a736b:web/js/store.js` saves
   (same key, same fields, same order of rolls) plus the three IndexedDB key shapes db.js
   used in 1.0.0: neg:/frm:/thm:. Nothing may be lost or misread. */
module.exports = async ({ page, shot, wait, text, click, log, errors }) => {
  const fail = m => { throw new Error(m); };

  const seeded = await page.evaluate(async () => {
    const KEY = 'contact-sheet.v1';
    const day = 86400000;
    const now = Date.now();
    const t = (d, h, m) => { const x = new Date(now - d * day); x.setHours(h, m, 0, 0); return x.getTime(); };

    const frames = (n, base, keepers) => Array.from({ length: n }, (_, i) => ({
      n: i + 1, at: base + i * 240000, flash: i % 5 === 0,
      seed: 100000 + i * 7919, keeper: keepers.includes(i + 1)
    }));

    // Exactly the record 1.0.0 wrote: onboarded, settings, roll, rolls, seq.
    const db = {
      onboarded: true,
      settings: { developHour: 9, sound: 'quiet', haptics: false, facing: 'user' },
      roll: {
        id: 'r4', no: 4, stock: 'statik', total: 36, loadedAt: t(0, 11, 5),
        state: 'loaded', push: 0, discreet: true, shared: false,
        frames: frames(2, t(0, 11, 10), [])
      },
      rolls: [
        { id: 'r3', no: 3, stock: 'nightbus1600', total: 36, loadedAt: t(1, 21, 0),
          state: 'lab', push: 1, discreet: false, shared: false,
          frames: frames(4, t(1, 21, 5), []), sentAt: t(1, 22, 30), developAt: now - 3600000 },
        { id: 'r2', no: 2, stock: 'cornerstore400', total: 36, loadedAt: t(6, 9, 0),
          state: 'developed', push: -1, discreet: true, shared: 3,
          frames: frames(5, t(6, 9, 30), [2, 3]), sentAt: t(6, 18, 0),
          developAt: t(5, 9, 0), developedAt: t(5, 9, 2) },
        { id: 'r1', no: 1, stock: 'meridian100', total: 36, loadedAt: t(20, 8, 0),
          state: 'developed', push: 0, discreet: false, shared: false,
          frames: frames(36, t(20, 8, 30), [1, 12, 36]), sentAt: t(20, 19, 0),
          developAt: t(19, 8, 0), developedAt: t(19, 8, 1) }
      ],
      seq: 4
    };
    localStorage.setItem(KEY, JSON.stringify(db));

    // IndexedDB, the way 1.0.0 wrote it: version 1, one 'blobs' store, string keys.
    const d = await new Promise((res, rej) => {
      const req = indexedDB.open('contact-sheet', 1);
      req.onupgradeneeded = () => { const dd = req.result; if (!dd.objectStoreNames.contains('blobs')) dd.createObjectStore('blobs'); };
      req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
    });
    const jpeg = (w, h, hue) => new Promise(res => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.fillStyle = `hsl(${hue} 55% 42%)`; x.fillRect(0, 0, w, h);
      x.fillStyle = `hsl(${(hue + 40) % 360} 70% 65%)`;
      x.beginPath(); x.arc(w * 0.5, h * 0.55, w * 0.3, 0, 6.283); x.fill();
      c.toBlob(b => res(b), 'image/jpeg', 0.86);
    });
    const put = (k, b) => new Promise((res, rej) => {
      const r = d.transaction('blobs', 'readwrite').objectStore('blobs').put(b, k);
      r.onsuccess = () => res(); r.onerror = () => rej(r.error);
    });
    let n = 0;
    for (const [id, count, kind] of [['r1', 36, 'dev'], ['r2', 5, 'dev'], ['r3', 4, 'neg'], ['r4', 2, 'neg']]) {
      for (let i = 1; i <= count; i++) {
        if (kind === 'neg') { await put(`neg:${id}:${i}`, await jpeg(360, 540, (i * 37) % 360)); n++; }
        else {
          await put(`frm:${id}:${i}`, await jpeg(720, 1080, (i * 23) % 360));
          await put(`thm:${id}:${i}`, await jpeg(180, 270, (i * 23) % 360));
          n += 2;
        }
      }
    }
    d.close();
    return { blobs: n, bytes: JSON.parse(localStorage.getItem(KEY)) ? localStorage.getItem(KEY).length : 0 };
  });
  log('seeded 1.0.0 device:', JSON.stringify(seeded));

  // Open the new build on that device.
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(1000);

  // r3 was due while the phone was off: the new build must develop it, not lose it.
  await shot('u01-lab');
  await wait(6000);
  await shot('u02-after-develop');

  const after = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('contact-sheet.v1'));
    return {
      onboarded: d.onboarded, settings: d.settings, seq: d.seq,
      rollInCamera: d.roll && { id: d.roll.id, no: d.roll.no, stock: d.roll.stock, frames: d.roll.frames.length, discreet: d.roll.discreet },
      rolls: d.rolls.map(r => ({ id: r.id, no: r.no, stock: r.stock, state: r.state, push: r.push,
                                 discreet: r.discreet, shared: r.shared, frames: r.frames.length,
                                 keepers: r.frames.filter(f => f.keeper).map(f => f.n) }))
    };
  });
  log('after upgrade:', JSON.stringify(after, null, 1));

  const s = after.settings;
  if (s.developHour !== 9 || s.sound !== 'quiet' || s.haptics !== false || s.facing !== 'user') fail('settings were not carried over: ' + JSON.stringify(s));
  if (after.seq !== 4) fail('the roll sequence was reset');
  if (!after.rollInCamera || after.rollInCamera.id !== 'r4' || after.rollInCamera.frames !== 2 || after.rollInCamera.discreet !== true) fail('the roll in the camera was lost');
  if (after.rolls.length !== 3) fail('rolls were lost: ' + after.rolls.length);

  const byId = Object.fromEntries(after.rolls.map(r => [r.id, r]));
  if (byId.r1.keepers.join() !== '1,12,36') fail('keepers on roll 1 were lost');
  if (byId.r1.frames !== 36) fail('roll 1 lost frames');
  if (byId.r2.push !== -1 || byId.r2.shared !== 3 || byId.r2.discreet !== true) fail('roll 2 lab marks were lost');
  if (byId.r2.keepers.join() !== '2,3') fail('keepers on roll 2 were lost');
  if (byId.r3.state !== 'developed') fail('the roll that was due did not develop: ' + byId.r3.state);
  if (byId.r3.push !== 1) fail('push on roll 3 was lost');

  const blobs = await page.evaluate(async () => ({
    neg: (await DB.keys('neg:')).length, frm: (await DB.keys('frm:')).length, thm: (await DB.keys('thm:')).length
  }));
  log('blobs after upgrade:', JSON.stringify(blobs));
  // r1 36 + r2 5 + r3 4 developed; r4's 2 negatives still undeveloped.
  if (blobs.frm !== 45 || blobs.thm !== 45) fail('developed frames missing: ' + JSON.stringify(blobs));
  if (blobs.neg !== 2) fail('negatives wrong after upgrade: ' + JSON.stringify(blobs));

  // Every screen must read the old data.
  await page.evaluate(() => window.App.show('sheets'));
  await wait(1400);
  await shot('u03-archive');
  const cards = await page.evaluate(() => Array.from(document.querySelectorAll('#sheetsList .rollcard')).map(c => c.innerText.replace(/\n/g, ' | ')));
  log('archive cards:', JSON.stringify(cards, null, 1));
  if (cards.length !== 3) fail('archive shows ' + cards.length + ' rolls');
  const stripBroken = await page.evaluate(() => Array.from(document.querySelectorAll('#sheetsList img')).filter(i => !i.complete || i.naturalWidth === 0).length);
  if (stripBroken) fail(stripBroken + ' broken thumbnails in the archive');

  // The 36 frame roll.
  await page.evaluate(() => { const c = Array.from(document.querySelectorAll('#sheetsList .rollcard')).find(x => x.innerText.includes('Roll 01')); c.click(); });
  await wait(1600);
  await shot('u04-sheet-36');
  const grid = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('#shGrid .cell'));
    return { cells: cells.length, withImg: cells.filter(c => c.querySelector('img')).length,
             broken: cells.filter(c => { const i = c.querySelector('img'); return i && (!i.complete || i.naturalWidth === 0); }).length,
             keepers: cells.filter(c => c.classList.contains('keeper')).length };
  });
  log('roll 1 grid:', JSON.stringify(grid));
  if (grid.cells !== 36 || grid.withImg !== 36 || grid.broken || grid.keepers !== 3) fail('the old sheet did not render: ' + JSON.stringify(grid));

  await page.evaluate(() => window.App.openFrame(12));
  await wait(900);
  await shot('u05-frame');
  const frOk = await page.evaluate(() => { const i = document.getElementById('frImg'); return i.complete && i.naturalWidth > 0; });
  if (!frOk) fail('an old developed frame does not open');

  // The roll that carried the marks.
  await page.evaluate(() => { window.App.back(); window.App.back(); });
  await wait(700);
  await page.evaluate(() => { const c = Array.from(document.querySelectorAll('#sheetsList .rollcard')).find(x => x.innerText.includes('Roll 02')); c.click(); });
  await wait(1400);
  await shot('u06-sheet-marks');
  const marks = await page.evaluate(() => document.getElementById('shMarks').innerText.replace(/\n/g, ' | '));
  log('marks on roll 2:', JSON.stringify(marks));
  if (!/pull/i.test(marks) || !/discreet/i.test(marks)) fail('lab marks not shown: ' + marks);
  if (/PULL -1DISCREET|PULL-1DISCREET/.test(marks.replace(/\s/g, ''))) fail('marks run together');

  await page.evaluate(() => window.App.openFrame(3));
  await wait(800);
  const shareLab = await text('#frShareLab');
  log('frame 3 share button:', shareLab);
  if (!/again/i.test(shareLab)) fail('the shared-frame mark was lost: ' + shareLab);

  // Settings still reads the old values and the storage line.
  await page.evaluate(() => window.App.show('settings'));
  await wait(1200);
  await shot('u07-settings');
  const setHour = await page.evaluate(() => document.getElementById('setHour').value);
  const sound = await page.evaluate(() => document.querySelector('#setSound button.on').dataset.v);
  const usage = await text('#usageLine');
  log('settings after upgrade:', setHour, sound, '|', usage);
  if (setHour !== '9' || sound !== 'quiet') fail('settings not shown as stored');
  if (!/MB/.test(usage)) fail('storage line did not compute: ' + usage);

  // Reload once more: still all there.
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(1500);
  const again = await page.evaluate(() => ({ rolls: Store.rolls.length, roll: Store.roll && Store.roll.frames.length,
                                             keepers: Store.rolls.map(r => Store.keepers(r).length) }));
  log('after a second open:', JSON.stringify(again));
  if (again.rolls !== 3 || again.roll !== 2 || again.keepers.join() !== '0,2,3') fail('data changed on the second open: ' + JSON.stringify(again));

  if (errors.length) fail('page errors: ' + errors.join(' | '));
};
