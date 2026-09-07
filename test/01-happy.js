/* Contact Sheet drive 1: first run, the covenant, loading a roll, shooting real frames,
   handing the roll in, and the lab developing it into a sheet.
   Run: node ../_shiptools/drive.js http://127.0.0.1:8820/index.html test/01-happy.js --out test/shots */
module.exports = async ({ page, shot, wait, text, click, log, errors }) => {
  const K = 'contact-sheet.v1';

  const before = await page.evaluate(k => localStorage.getItem(k), K);
  log('storage before first paint:', before === null ? 'empty' : 'present');
  if (before !== null) throw new Error('first run was not clean');

  await wait(500);
  await shot('01-covenant');
  log('covenant visible:', await page.evaluate(() => !document.getElementById('v-covenant').hidden));

  // Onboarding is a roll: covenant -> the shelf.
  await click('#covGo');
  await wait(500);
  await shot('02-shelf');
  log('stocks on the shelf:', await page.evaluate(() => document.querySelectorAll('#shelf button').length));

  // One stock, its box, its curve.
  await page.evaluate(() => document.querySelectorAll('#shelf button')[1].click());
  await wait(450);
  await shot('03-stock');
  log('stock title:', await text('#stTitle'));
  log('curve paths:', await page.evaluate(() => document.querySelectorAll('#stCurve .ln').length));

  // Load it. The camera comes up with a counter at 36.
  await click('#stLoad');
  await wait(1800);
  await shot('04-camera-loaded');
  log('counter:', await text('#cNum'), await text('#cStock'));
  log('camera state:', await page.evaluate(() => Cam.state));
  if (await page.evaluate(() => Cam.state) !== 'ready') throw new Error('the camera did not open');

  // Shoot. Each frame is a real capture through the app's own path.
  const fire = async n => {
    for (let i = 0; i < n; i++) {
      await page.evaluate(() => document.getElementById('shutterBtn').click());
      await wait(1400);
    }
  };
  await page.evaluate(() => document.getElementById('shutterBtn').click());
  await wait(320);
  await shot('05-windon');
  await wait(1200);
  await fire(2);
  log('after 3 frames, counter:', await text('#cNum'));
  log('frames recorded:', await page.evaluate(() => Store.roll.frames.length));
  const negs = await page.evaluate(async () => (await DB.keys('neg:')).length);
  log('negatives in IndexedDB:', negs);
  if (negs !== 3) throw new Error('negatives were not stored: ' + negs);

  // Nothing the shutter made may be on screen anywhere.
  const leaked = await page.evaluate(() => {
    const imgs = Array.from(document.images).filter(i => i.src && i.src.startsWith('blob:') && i.offsetParent);
    return imgs.length;
  });
  log('visible blob images while shooting:', leaked);
  if (leaked) throw new Error('an undeveloped frame is on screen');

  await shot('06-camera-shot');

  // Hand the roll in unfinished, with lab instructions.
  await click('#rollBtn');
  await wait(400);
  await shot('07-rollpanel');
  await click('#rpHand');
  await wait(400);
  await shot('08-rewind');
  await wait(2200);
  await shot('09-counter');
  await page.evaluate(() => document.querySelector('#pushSeg button[data-v="1"]').click());
  await wait(200);
  await click('#rwGo');
  await wait(800);
  await shot('10-handed-in');
  log('roll in camera after hand in:', await page.evaluate(() => Store.roll));
  log('rolls at the lab:', await page.evaluate(() => Store.atLab().length));
  log('push recorded:', await page.evaluate(() => Store.rolls[0].push));

  // The sheets archive shows it waiting.
  await click('#toSheets');
  await wait(600);
  await shot('11-sheets-waiting');
  log('sheets list text:', (await text('#sheetsList')).replace(/\n/g, ' | '));

  // Wind the lab clock back so the roll is due, then reopen.
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('contact-sheet.v1'));
    d.rolls[0].developAt = Date.now() - 60000;
    localStorage.setItem('contact-sheet.v1', JSON.stringify(d));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(700);
  await shot('12-lab');
  await wait(4000);
  await shot('13-sheet');
  log('view after developing:', await page.evaluate(() => document.querySelector('#stage .screen:not([hidden])').id));
  log('state:', await page.evaluate(() => Store.rolls[0].state));
  const after = await page.evaluate(async () => ({
    negs: (await DB.keys('neg:')).length,
    frms: (await DB.keys('frm:')).length,
    thms: (await DB.keys('thm:')).length
  }));
  log('after development:', JSON.stringify(after));
  if (after.negs !== 0) throw new Error('negatives were not purged');
  if (after.frms !== 3 || after.thms !== 3) throw new Error('frames did not develop');

  // A frame, and the grease pencil.
  await page.evaluate(() => App.openFrame(2));
  await wait(800);
  await shot('14-frame');
  await click('#frKeep');
  await wait(700);
  await shot('15-kept');
  log('keepers:', await page.evaluate(() => Store.keepers(Store.rolls[0]).length));

  await page.evaluate(() => App.back());
  await wait(600);
  await shot('16-sheet-kept');

  // Settings, and the storage line.
  await page.evaluate(() => App.show('settings'));
  await wait(900);
  await shot('17-settings');
  log('usage line:', await text('#usageLine'));

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
