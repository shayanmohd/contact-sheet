/* Contact Sheet drive 6: the app under a light system theme. Contact Sheet is a darkroom and
   ships one theme on purpose, so the only thing to prove is that a light system setting does
   not bleach a control or leave a form field unreadable.
   Run: node ../_shiptools/drive.js http://127.0.0.1:8820/index.html test/06-light.js --out test/shots */
module.exports = async ({ page, shot, wait, log, errors }) => {
  await page.evaluate(async () => { localStorage.clear(); await DB.clear(); });
  await page.evaluate(() => localStorage.setItem('contact-sheet.v1', JSON.stringify({
    onboarded: true, settings: { developHour: 8, sound: 'full', haptics: true, facing: 'environment' },
    roll: null, rolls: [], seq: 0 })));
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(900);
  await shot('60-light-camera');
  await page.evaluate(() => App.show('settings'));
  await wait(900);
  await shot('61-light-settings');
  const colours = await page.evaluate(() => {
    const out = {};
    const cs = el => { const c = getComputedStyle(el); return [c.color, c.backgroundColor]; };
    out.body = cs(document.body);
    out.select = cs(document.getElementById('setHour'));
    out.check = getComputedStyle(document.getElementById('setHaptics')).accentColor;
    out.scheme = getComputedStyle(document.documentElement).colorScheme;
    return out;
  });
  log('colours under a light system theme:', JSON.stringify(colours));
  if (!/13, 17, 16|19, 17, 16/.test(colours.body[1])) log('note: body background is ' + colours.body[1]);
  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
};
