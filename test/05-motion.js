/* Contact Sheet drive 5: the whole happy path with motion off, and the app under a light
   system theme. Android maps "animations off" to prefers-reduced-motion: reduce, so the
   wind-on, the safelight and the grease pencil all have to still say something when they
   cannot move. Nothing may vanish; only the travel stops.
   Run: node ../_shiptools/drive.js http://127.0.0.1:8820/index.html test/05-motion.js --out test/shots --reduced-motion */
module.exports = async ({ page, shot, wait, text, click, log, errors }) => {
  await page.evaluate(async () => { localStorage.clear(); await DB.clear(); });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(800);
  log('reduced motion in the page:', await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches));

  await shot('50-rm-covenant');
  await click('#covGo'); await wait(600);
  await shot('51-rm-shelf');
  await page.evaluate(() => document.querySelectorAll('#shelf button')[2].click());
  await wait(500);
  await shot('52-rm-stock');
  await click('#stLoad'); await wait(1800);
  await shot('53-rm-camera');

  // The wind-on must still show its 1.2 seconds of travel as something readable.
  await page.evaluate(() => document.getElementById('shutterBtn').click());
  await wait(500);
  const wind = await page.evaluate(() => {
    const bar = document.getElementById('ratchet');
    return { shown: !document.getElementById('windOn').hidden, width: bar.style.width,
             painted: bar.getBoundingClientRect().width };
  });
  log('wind-on halfway with motion off:', JSON.stringify(wind));
  await shot('54-rm-windon');
  if (wind.shown && wind.painted <= 0) throw new Error('the wind-on indicator is invisible with motion off');
  await wait(1500);

  for (let i = 0; i < 2; i++) { await page.evaluate(() => document.getElementById('shutterBtn').click()); await wait(1500); }

  // Hand it in, develop, and look at the sheet and a keeper.
  await page.evaluate(() => { document.getElementById('rollBtn').click(); });
  await wait(400);
  await page.evaluate(() => document.getElementById('rpHand').click());
  await wait(500);
  await shot('55-rm-rewind');
  await wait(2200);
  await page.evaluate(() => document.getElementById('rwGo').click());
  await wait(900);
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('contact-sheet.v1'));
    d.rolls[0].developAt = Date.now() - 1000;
    localStorage.setItem('contact-sheet.v1', JSON.stringify(d));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(600);
  await shot('56-rm-lab');
  await page.waitForFunction(() => Store.rolls[0].state === 'developed', { timeout: 60000 });
  await wait(900);
  await shot('57-rm-sheet');
  await page.evaluate(() => App.openFrame(2));
  await wait(600);
  await click('#frKeep');
  await wait(700);
  await shot('58-rm-kept');
  const pencil = await page.evaluate(() => {
    const path = document.querySelector('#frPencil path');
    const box = path.getBoundingClientRect();
    return { w: Math.round(box.width), h: Math.round(box.height),
             opacity: getComputedStyle(document.getElementById('frPencil')).opacity,
             offset: getComputedStyle(path).strokeDashoffset };
  });
  log('grease pencil with motion off:', JSON.stringify(pencil));
  if (pencil.w < 20 || pencil.opacity === '0') throw new Error('the keeper mark disappeared with motion off');

  // The safelight in the lab must still be a light, not nothing.
  const safelight = await page.evaluate(() => {
    App.show('lab');
    const el = document.querySelector('.safelight');
    const cs = getComputedStyle(el);
    return { opacity: cs.opacity, w: el.getBoundingClientRect().width };
  });
  log('safelight with motion off:', JSON.stringify(safelight));
  if (Number(safelight.opacity) < 0.2 || safelight.w < 50) throw new Error('the safelight vanished with motion off');

  // The counter glow at the end of a roll must hold, not blink out.
  const glow = await page.evaluate(() => {
    App.show('camera');
    const el = document.getElementById('cNum');
    el.classList.add('low');
    return getComputedStyle(el).opacity;
  });
  log('low-frames counter opacity with motion off:', glow);
  if (Number(glow) < 0.5) throw new Error('the low-frame counter faded out with motion off');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
