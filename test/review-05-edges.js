/* Reviewer drive 5: the taps that cost something, the states that used to strand you, and
   the drawn parts under reduced motion. Run once plain and once with --reduced-motion. */
module.exports = async ({ page, shot, wait, text, click, log, errors }) => {
  const fail = m => { throw new Error(m); };
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  log('reduced motion:', reduced);
  const tag = reduced ? 'rm-' : 'e-';

  // A double tap on the covenant button must not skip anything or fire twice.
  await page.evaluate(() => { localStorage.removeItem('contact-sheet.v1'); });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(600);
  await page.evaluate(() => { const b = document.getElementById('covGo'); b.click(); b.click(); b.click(); });
  await wait(700);
  await shot(tag + '01-shelf');
  const v = await page.evaluate(() => document.querySelector('#stage .screen:not([hidden])').id);
  if (v !== 'v-stocks') fail('triple tap on the covenant went to ' + v);

  // A double tap on Load this roll must burn exactly one roll number.
  await page.evaluate(() => document.querySelectorAll('#shelf button')[0].click());
  await wait(500);
  await page.evaluate(() => { const b = document.getElementById('stLoad'); b.click(); b.click(); b.click(); });
  await wait(2400);
  const seq = await page.evaluate(() => ({ seq: Store.all().seq, no: Store.roll && Store.roll.no, rolls: Store.rolls.length }));
  log('after a triple tap on load:', JSON.stringify(seq));
  if (seq.seq !== 1 || seq.no !== 1 || seq.rolls !== 0) fail('a double tap burned a roll: ' + JSON.stringify(seq));
  await shot(tag + '02-loaded');

  // The wind-on must show real progress, not snap, with motion off.
  await page.evaluate(() => document.getElementById('shutterBtn').click());
  await wait(420);
  const wind = await page.evaluate(() => {
    const b = document.getElementById('ratchet');
    return { shown: !document.getElementById('windOn').hidden, width: b.style.width, painted: b.getBoundingClientRect().width };
  });
  log('wind-on partway:', JSON.stringify(wind));
  await shot(tag + '03-windon');
  if (!wind.shown) fail('the wind-on bar was not showing');
  const pct = parseFloat(wind.width);
  if (!(pct > 4 && pct < 96)) fail('the wind-on snapped instead of running: ' + wind.width);
  await wait(1400);

  // Shoot to the end of the roll through the app's own path, then the finished state.
  await page.evaluate(() => { for (let i = 0; i < 34; i++) Store.recordFrame({}); window.App.renderCamera(); });
  await wait(200);
  await page.evaluate(() => document.getElementById('shutterBtn').click());
  await wait(3200);
  await shot(tag + '04-rewind');
  // Backing out of the rewind sheet must leave a way forward, not a dead camera.
  await page.evaluate(() => window.App.back());
  await wait(700);
  await shot(tag + '05-finished');
  const fin = await page.evaluate(() => ({
    finished: !document.getElementById('fullCam').hidden,
    controls: document.getElementById('controls').hidden,
    art: document.getElementById('fullCamArt').innerHTML.length,
    artBox: (() => { const a = document.getElementById('fullCamArt').getBoundingClientRect(); return { w: Math.round(a.width), h: Math.round(a.height) }; })(),
    artOpacity: getComputedStyle(document.getElementById('fullCamArt')).opacity
  }));
  log('finished roll state:', JSON.stringify(fin));
  if (!fin.finished || !fin.controls) fail('a finished roll left a dead camera');
  if (fin.art < 400 || fin.artBox.w < 80 || fin.artBox.h < 40) fail('the finished state has no drawn art');
  if (+fin.artOpacity < 0.9) fail('the drawn art is invisible: opacity ' + fin.artOpacity);

  // Hand it in, twice at once.
  await page.evaluate(() => { const b = document.getElementById('fullHand'); b.click(); b.click(); });
  await wait(2800);
  await page.evaluate(() => { const b = document.getElementById('rwGo'); b.click(); b.click(); });
  await wait(1000);
  const lab = await page.evaluate(() => ({ atLab: Store.atLab().length, roll: Store.roll, seq: Store.all().seq }));
  log('after handing in twice:', JSON.stringify(lab));
  if (lab.atLab !== 1 || lab.roll !== null) fail('handing in twice made a mess: ' + JSON.stringify(lab));

  // The empty camera, drawn.
  await shot(tag + '06-empty');
  const emp = await page.evaluate(() => ({
    shown: !document.getElementById('emptyCam').hidden,
    art: document.getElementById('emptyCamArt').innerHTML.length,
    box: (() => { const a = document.getElementById('emptyCamArt').getBoundingClientRect(); return { w: Math.round(a.width), h: Math.round(a.height) }; })(),
    opacity: getComputedStyle(document.getElementById('emptyCamArt')).opacity
  }));
  log('empty camera:', JSON.stringify(emp));
  if (!emp.shown || emp.art < 400 || emp.box.h < 40 || +emp.opacity < 0.9) fail('the empty camera has no drawn art: ' + JSON.stringify(emp));

  // The archive empty state keeps its drawing too.
  await page.evaluate(() => { const d = Store.all(); d.rolls.length = 0; Store.save(); window.App.show('sheets'); });
  await wait(700);
  await shot(tag + '07-empty-archive');
  const arch = await page.evaluate(() => {
    const a = document.getElementById('sheetsEmptyArt').getBoundingClientRect();
    return { shown: !document.getElementById('sheetsEmpty').hidden, w: Math.round(a.width), h: Math.round(a.height),
             opacity: getComputedStyle(document.getElementById('sheetsEmptyArt')).opacity };
  });
  log('empty archive:', JSON.stringify(arch));
  if (!arch.shown || arch.h < 40 || +arch.opacity < 0.9) fail('the empty archive lost its drawing');

  // The lab bar and the counter still read with motion off.
  await page.evaluate(() => window.App.show('lab'));
  await wait(500);
  await shot(tag + '08-lab');

  if (errors.length) fail('page errors: ' + errors.join(' | '));
};
