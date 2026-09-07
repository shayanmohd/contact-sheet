/* Contact Sheet drive 3: the upgrade from the shipped 1.0.0.
   Seeds localStorage and IndexedDB with records shaped exactly as 1.0.0 wrote them
   (git show 75a736b:web/js/store.js and web/js/db.js), then loads this build and proves
   that every roll, frame, keeper, push, share mark, setting and image survived.
   Run: node ../_shiptools/drive.js http://127.0.0.1:8820/index.html test/03-upgrade.js --out test/shots */
module.exports = async ({ page, shot, wait, text, log, errors }) => {
  const seeded = await page.evaluate(async () => {
    // Wipe anything this browser profile carries.
    localStorage.clear();
    await DB.clear();

    const now = Date.now(), hour = 36e5, day = 864e5;
    const frames = (n, endAt, span, keeps) => {
      const out = [];
      for (let i = 1; i <= n; i++) out.push({ n: i, at: Math.round(endAt - span + span * i / n),
        flash: i % 7 === 0, seed: (i * 104729) % 1e9, keeper: keeps.includes(i) });
      return out;
    };
    /* Exactly the shape store.js 1.0.0 saved: onboarded, settings{developHour,sound,haptics,facing},
       roll (or null), rolls[] newest first, seq. Rolls carry
       id,no,stock,total,loadedAt,state,push,discreet,shared,frames[] and, once handed in, sentAt,
       developAt and (once developed) developedAt. */
    const oldRecord = {
      onboarded: true,
      settings: { developHour: 9, sound: 'quiet', haptics: false, facing: 'user' },
      roll: { id: 'r4', no: 4, stock: 'statik', total: 36, loadedAt: now - 3 * hour,
              state: 'loaded', push: 0, discreet: false, shared: false,
              frames: frames(17, now - 6e5, 3 * hour, []) },
      rolls: [
        { id: 'r3', no: 3, stock: 'nightbus1600', total: 36, loadedAt: now - day - 8 * hour,
          state: 'lab', push: 1, discreet: true, shared: false,
          sentAt: now - 5 * hour, developAt: now + 4 * hour,
          frames: frames(36, now - 5 * hour, 7 * hour, []) },
        { id: 'r2', no: 2, stock: 'gullwing', total: 36, loadedAt: now - 5 * day,
          state: 'developed', push: -1, discreet: false, shared: 14,
          sentAt: now - 4 * day, developAt: now - 3 * day, developedAt: now - 3 * day + 12e4,
          frames: frames(36, now - 4 * day, 30 * hour, [3, 14, 22, 31]) },
        { id: 'r1', no: 1, stock: 'meridian100', total: 36, loadedAt: now - 12 * day,
          state: 'developed', push: 0, discreet: false, shared: false,
          sentAt: now - 11 * day, developAt: now - 10 * day, developedAt: now - 10 * day + 9e4,
          frames: frames(21, now - 11 * day, 40 * hour, [6, 9]) }
      ],
      seq: 4
    };
    localStorage.setItem('contact-sheet.v1', JSON.stringify(oldRecord));

    // The blobs 1.0.0 put in IndexedDB, under exactly its three key shapes.
    const paint = async (w, h, hue) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = `hsl(${hue},38%,42%)`; g.fillRect(0, 0, w, h);
      g.fillStyle = `hsl(${hue},60%,78%)`; g.fillRect(w * 0.2, h * 0.25, w * 0.6, h * 0.4);
      return new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    };
    let n = 0;
    for (const roll of oldRecord.rolls.filter(r => r.state === 'developed')) {
      for (const f of roll.frames) {
        await DB.put(DB.frmKey(roll.id, f.n), await paint(300, 450, (f.n * 13 + roll.no * 60) % 360));
        await DB.put(DB.thmKey(roll.id, f.n), await paint(120, 180, (f.n * 13 + roll.no * 60) % 360));
        n += 2;
      }
    }
    // undeveloped negatives for the roll at the lab and the roll in the camera
    for (const roll of [oldRecord.rolls[0], oldRecord.roll]) {
      for (const f of roll.frames) { await DB.put(DB.negKey(roll.id, f.n), await paint(200, 300, 20)); n++; }
    }
    return { keys: n, record: localStorage.getItem('contact-sheet.v1').length };
  });
  log('seeded 1.0.0 device:', JSON.stringify(seeded));

  // Now load the new build over it.
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(1400);
  await shot('30-upgrade-camera');

  const read = await page.evaluate(async () => ({
    onboarded: Store.onboarded(),
    settings: Store.settings(),
    liveRoll: Store.roll && { id: Store.roll.id, no: Store.roll.no, stock: Store.roll.stock,
                              shot: Store.roll.frames.length, left: Store.left() },
    rolls: Store.rolls.map(r => ({ id: r.id, no: r.no, stock: r.stock, state: r.state, push: r.push,
                                   discreet: r.discreet, shared: r.shared, frames: r.frames.length,
                                   keepers: Store.keepers(r).length, span: Store.dateSpan(r) })),
    seq: Store.all().seq,
    idb: { neg: (await DB.keys('neg:')).length, frm: (await DB.keys('frm:')).length, thm: (await DB.keys('thm:')).length },
    counterStock: document.getElementById('cStock').textContent,
    counterNum: document.getElementById('cNum').textContent
  }));
  log('read back:', JSON.stringify(read, null, 1));

  const want = { developHour: 9, sound: 'quiet', haptics: false, facing: 'user' };
  for (const k of Object.keys(want)) {
    if (read.settings[k] !== want[k]) throw new Error('setting ' + k + ' was lost: ' + read.settings[k]);
  }
  if (!read.liveRoll || read.liveRoll.shot !== 17 || read.liveRoll.left !== 19) throw new Error('the roll in the camera changed');
  if (read.rolls.length !== 3) throw new Error('rolls were lost');
  if (read.rolls[1].keepers !== 4 || read.rolls[1].shared !== 14 || read.rolls[1].push !== -1) throw new Error('roll 2 lost its marks');
  if (read.rolls[2].frames !== 21) throw new Error('roll 1 lost frames');
  if (read.seq !== 4) throw new Error('the roll counter reset');
  if (read.idb.frm !== 57 || read.idb.thm !== 57 || read.idb.neg !== 53) throw new Error('IndexedDB lost blobs: ' + JSON.stringify(read.idb));
  if (read.counterNum !== '19') throw new Error('the counter misread the old roll: ' + read.counterNum);

  // The archive and an old sheet must render from the old blobs.
  await page.evaluate(() => App.show('sheets'));
  await wait(1300);
  await shot('31-upgrade-sheets');
  await page.evaluate(() => document.querySelectorAll('.rollcard')[1].click());
  await wait(1600);
  await shot('32-upgrade-sheet');
  const grid = await page.evaluate(() => ({
    cells: document.querySelectorAll('#shGrid .cell').length,
    withImage: Array.from(document.querySelectorAll('#shGrid img.im')).filter(i => i.src).length,
    broken: Array.from(document.querySelectorAll('#shGrid img.im')).filter(i => i.src && !i.complete).length,
    kept: document.getElementById('shKept').textContent,
    marks: document.getElementById('shMarks').textContent
  }));
  log('old sheet:', JSON.stringify(grid));
  if (grid.withImage !== 36) throw new Error('the old sheet lost frames: ' + grid.withImage);

  await page.evaluate(() => App.openFrame(14));
  await wait(900);
  await shot('33-upgrade-frame');
  const fr = await page.evaluate(() => ({
    src: !!document.getElementById('frImg').src,
    w: document.getElementById('frImg').naturalWidth,
    keep: document.getElementById('frKeep').textContent,
    share: document.getElementById('frShare').textContent
  }));
  log('old frame:', JSON.stringify(fr));
  if (!fr.src || !fr.w) throw new Error('an old frame will not display');
  if (fr.share !== 'Send it again') throw new Error('the old share mark was misread: ' + fr.share);

  // Settings must reflect the old values, not the defaults.
  await page.evaluate(() => App.show('settings'));
  await wait(1000);
  await shot('34-upgrade-settings');
  const set = await page.evaluate(() => ({
    hour: document.getElementById('setHour').value,
    sound: (document.querySelector('#setSound button.on') || {}).dataset,
    haptics: document.getElementById('setHaptics').checked,
    usage: document.getElementById('usageLine').textContent
  }));
  log('settings screen:', JSON.stringify(set));
  if (set.hour !== '9' || set.haptics !== false) throw new Error('the settings screen shows defaults, not the stored values');

  // And the old roll still develops with this build.
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('contact-sheet.v1'));
    d.rolls[0].developAt = Date.now() - 1000;
    localStorage.setItem('contact-sheet.v1', JSON.stringify(d));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(1200);
  await shot('35-upgrade-lab');
  await page.waitForFunction(() => Store.rolls[0].state === 'developed', { timeout: 90000 });
  await wait(1200);
  await shot('36-upgrade-developed');
  const after = await page.evaluate(async () => ({
    state: Store.rolls[0].state,
    negs: (await DB.keys('neg:')).length,
    frms: (await DB.keys('frm:r3:')).length
  }));
  log('the 1.0.0 roll developed under 1.0.1:', JSON.stringify(after));
  if (after.frms !== 36) throw new Error('the old roll did not develop');
  if (after.negs !== 17) throw new Error('purging took the wrong negatives: ' + after.negs);

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
