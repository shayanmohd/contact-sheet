/* Contact Sheet drive 4: the edges. Rapid double taps on every primary button, the finished
   roll, an unexposed roll, deleting a roll, erasing everything, both export paths, the lab
   cut-off, and a device carrying far more rolls than the notification schedule can hold.
   Run: node ../_shiptools/drive.js http://127.0.0.1:8820/index.html test/04-edges.js --out test/shots */
module.exports = async ({ page, shot, wait, text, click, log, errors }) => {
  const w = ms => new Promise(r => setTimeout(r, ms));

  await page.evaluate(async () => { localStorage.clear(); await DB.clear(); });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(800);

  // ---- double tap the covenant button ----
  const dbl = sel => page.evaluate(s => { const b = document.querySelector(s); b.click(); b.click(); }, sel);
  await dbl('#covGo');
  await wait(600);
  log('after a double tap on the covenant:', await page.evaluate(() => document.querySelector('#stage .screen:not([hidden])').id));

  // ---- double tap "load this roll": one roll, not two ----
  await page.evaluate(() => document.querySelectorAll('#shelf button')[0].click());
  await wait(400);
  await dbl('#stLoad');
  await wait(1800);
  const loaded = await page.evaluate(() => ({ seq: Store.all().seq, no: Store.roll.no, rolls: Store.rolls.length }));
  log('after a double tap on load:', JSON.stringify(loaded));
  if (loaded.seq !== 1 || loaded.rolls !== 0) throw new Error('a double tap burned a roll: ' + JSON.stringify(loaded));

  // ---- rapid shutter taps must not consume more than one frame per wind-on ----
  await page.evaluate(() => { const b = document.getElementById('shutterBtn'); for (let i = 0; i < 6; i++) b.click(); });
  await wait(2200);
  const burst = await page.evaluate(async () => ({ shot: Store.roll.frames.length, negs: (await DB.keys('neg:')).length }));
  log('after six shutter taps in one go:', JSON.stringify(burst));
  if (burst.shot !== 1) throw new Error('the shutter fired ' + burst.shot + ' times on one tap');

  // ---- the finished roll: fill it to 36 and see what the camera does ----
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('contact-sheet.v1'));
    const now = Date.now();
    for (let i = d.roll.frames.length + 1; i <= 35; i++)
      d.roll.frames.push({ n: i, at: now - (36 - i) * 6e4, flash: false, seed: i * 7919, keeper: false });
    localStorage.setItem('contact-sheet.v1', JSON.stringify(d));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(1600);
  log('one frame left:', await text('#cNum'));
  await page.evaluate(() => document.getElementById('shutterBtn').click());
  await wait(1400);
  await shot('40-roll-finished');
  const fin = await page.evaluate(() => ({
    view: document.querySelector('#stage .screen:not([hidden])').id,
    modal: !document.getElementById('rewind').hidden,
    left: Store.left()
  }));
  log('after the last frame:', JSON.stringify(fin));
  if (!fin.modal) throw new Error('frame 36 did not send the roll to the counter');

  // Backing out of the rewind modal must not strand the user with a dead shutter.
  await page.evaluate(() => App.back());
  await wait(500);
  await shot('41-backed-out-of-rewind');
  const stranded = await page.evaluate(() => ({
    left: Store.left(),
    shutter: document.getElementById('shutterBtn').disabled,
    emptyCam: !document.getElementById('emptyCam').hidden,
    fullCam: !!document.getElementById('fullCam') && !document.getElementById('fullCam').hidden,
    visibleText: document.querySelector('#v-camera').innerText.replace(/\n/g, ' | ')
  }));
  log('camera with a finished roll and no modal:', JSON.stringify(stranded));

  // Hand it in for real.
  await page.evaluate(() => { document.getElementById('rollBtn').click(); });
  await wait(400);
  await page.evaluate(() => document.getElementById('rpHand').click());
  await wait(2600);
  await page.evaluate(() => { const b = document.getElementById('rwGo'); b.click(); b.click(); });
  await wait(900);
  const handed = await page.evaluate(() => ({ lab: Store.atLab().length, roll: Store.roll, rolls: Store.rolls.length }));
  log('after a double tap on hand it in:', JSON.stringify(handed));
  if (handed.rolls !== 1) throw new Error('a double tap handed the roll in twice');

  // ---- the empty camera ----
  await shot('42-empty-camera');
  const empty = await page.evaluate(() => ({
    view: document.querySelector('#stage .screen:not([hidden])').id,
    emptyShown: !document.getElementById('emptyCam').hidden,
    controls: !document.getElementById('controls').hidden,
    counter: document.getElementById('cNum').textContent
  }));
  log('empty camera:', JSON.stringify(empty));
  if (!empty.emptyShown) throw new Error('the empty camera state is missing');

  // ---- an unexposed roll simply comes back out ----
  await page.evaluate(() => { App.show('stocks'); });
  await wait(500);
  await page.evaluate(() => document.querySelectorAll('#shelf button')[3].click());
  await wait(400);
  await page.evaluate(() => document.getElementById('stLoad').click());
  await wait(1600);
  await page.evaluate(() => { document.getElementById('rollBtn').click(); });
  await wait(400);
  await shot('43-unexposed-panel');
  await page.evaluate(() => document.getElementById('rpHand').click());
  await wait(700);
  const unexposed = await page.evaluate(() => ({ roll: Store.roll, rolls: Store.rolls.length }));
  log('an unexposed roll taken out:', JSON.stringify(unexposed));
  if (unexposed.roll !== null || unexposed.rolls !== 1) throw new Error('an unexposed roll went to the lab');

  // ---- the lab cut-off and the develop hour ----
  const clock = await page.evaluate(() => {
    const at = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); };
    return {
      morning: Store.backLine(Store.developTime(at(9, 0), 8), at(9, 0)),
      afternoon: Store.backLine(Store.developTime(at(15, 0), 8), at(15, 0)),
      justBefore: Store.backLine(Store.developTime(at(19, 59), 8), at(19, 59)),
      justAfter: Store.backLine(Store.developTime(at(20, 1), 8), at(20, 1)),
      earlyBird: Store.backLine(Store.developTime(at(6, 0), 8), at(6, 0)),
      pastNever: Store.developTime(at(20, 1), 8) > at(20, 1)
    };
  });
  log('lab clock:', JSON.stringify(clock));
  if (!clock.pastNever) throw new Error('a roll was scheduled to come back in the past');

  // ---- a device with many rolls at the lab ----
  const many = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('contact-sheet.v1'));
    const now = Date.now();
    d.rolls = [];
    for (let i = 1; i <= 90; i++) {
      d.rolls.push({ id: 'x' + i, no: i, stock: 'meridian100', total: 36, loadedAt: now,
        state: 'lab', push: 0, discreet: false, shared: false, sentAt: now,
        developAt: now + i * 36e5, frames: [{ n: 1, at: now, flash: false, seed: 1, keeper: false }] });
    }
    d.seq = 90;
    localStorage.setItem('contact-sheet.v1', JSON.stringify(d));
    return d.rolls.length;
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(1200);
  const notes = await page.evaluate(() => Store.notifications());
  log(many + ' rolls at the lab gives ' + notes.length + ' notifications, ids unique: ' +
      (new Set(notes.map(n => n.id)).size === notes.length) +
      ', all future: ' + notes.every(n => n.at > Date.now()));
  if (notes.length > 64) throw new Error('too many notifications');
  if (new Set(notes.map(n => n.id)).size !== notes.length) throw new Error('notification ids collide');
  await page.evaluate(() => App.show('sheets'));
  await wait(1400);
  await shot('44-many-rolls');

  // ---- export, both paths ----
  const exported = await page.evaluate(async () => {
    const d = JSON.parse(localStorage.getItem('contact-sheet.v1'));
    const now = Date.now();
    d.rolls = [{ id: 'e1', no: 7, stock: 'riviera50', total: 36, loadedAt: now - 864e5,
      state: 'developed', push: 0, discreet: true, shared: false, sentAt: now - 72e6,
      developAt: now - 36e5, developedAt: now - 36e5,
      frames: [1,2,3,4,5].map(n => ({ n, at: now - n * 6e4, flash: false, seed: n * 31, keeper: n === 2 })) }];
    localStorage.setItem('contact-sheet.v1', JSON.stringify(d));
    return true;
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(1000);
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 450;
    const g = c.getContext('2d'); g.fillStyle = '#2f6b8f'; g.fillRect(0, 0, 300, 450);
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
    for (let n = 1; n <= 5; n++) { await DB.put(DB.frmKey('e1', n), b); await DB.put(DB.thmKey('e1', n), b); }
  });
  const saved = await page.evaluate(async () => {
    const calls = [];
    window.Native = {
      isNative: () => true,
      saveFile: (name, mime, b64) => { calls.push({ name, mime, bytes: b64.length }); return 'content://out/' + name; },
      shareUri: (uri, mime) => { calls.push({ shared: uri, mime }); return true; },
      vibrate: () => {}, vibratePattern: () => {},
      scheduleNotifications: json => calls.push({ notes: JSON.parse(json).length }),
      notificationsAllowed: () => true
    };
    const roll = Store.rolls[0];
    const sheetBlob = await Export.sheet(roll);
    const cardBlob = await Export.frameCard(roll, 2);
    const a = await Export.save('sheet.jpg', sheetBlob);
    const b = await Export.share('card.jpg', cardBlob, 'A frame');
    return { calls, a, b, sheetBytes: sheetBlob.size, cardBytes: cardBlob.size, sheetType: sheetBlob.type };
  });
  log('native export:', JSON.stringify(saved));
  if (saved.a !== 'content://out/sheet.jpg' || saved.b !== 'shared') throw new Error('the native save path is broken');
  if (!saved.sheetBytes || !saved.cardBytes) throw new Error('an export produced an empty file');

  const dl = await page.evaluate(async () => {
    delete window.Native;
    let clicked = null;
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { clicked = { name: this.download, href: this.href.slice(0, 5) }; };
    const roll = Store.rolls[0];
    const r = await Export.save('sheet.jpg', await Export.sheet(roll));
    HTMLAnchorElement.prototype.click = realClick;
    return { r, clicked };
  });
  log('browser download path:', JSON.stringify(dl));
  if (dl.r !== 'download' || !dl.clicked || dl.clicked.href !== 'blob:') throw new Error('the download path is broken');

  // ---- delete a roll, then erase everything ----
  await page.evaluate(() => { App.show('sheets'); });
  await wait(1200);
  await page.evaluate(() => document.querySelectorAll('.rollcard')[0].click());
  await wait(1400);
  await shot('45-sheet-before-delete');
  await page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    document.getElementById('shMenu').click(); await w(300);
    document.getElementById('smDelete').click(); await w(200);
    document.getElementById('smDelete').click(); await w(900);
  });
  await wait(1200);
  const deleted = await page.evaluate(async () => ({
    rolls: Store.rolls.length,
    frm: (await DB.keys('frm:')).length,
    thm: (await DB.keys('thm:')).length,
    view: document.querySelector('#stage .screen:not([hidden])').id
  }));
  log('after deleting the roll:', JSON.stringify(deleted));
  if (deleted.frm || deleted.thm) throw new Error('deleting a roll left its images behind');
  await shot('46-sheets-empty');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
