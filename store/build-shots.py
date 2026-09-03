#!/usr/bin/env python3
"""Writes store/shots.json for _shiptools/shots.js.

The seed sets a believable ledger and swaps getUserMedia for a canvas stream so
the viewfinder has something in it. The first shot's `before` then runs the app's
own development pipeline over drawn scenes, so every frame on every sheet in the
store screenshots came out of Film.renderTo exactly as it would on a phone."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
SCENES = open(os.path.join(HERE, 'scenes.js'), encoding='utf-8').read()

STATE = r"""
;(function () {
  var K = 'contact-sheet.v1';
  var now = Date.now(), day = 86400000, hour = 3600000, min = 60000;

  function eight(daysAhead) {
    var d = new Date();
    d.setHours(8, 0, 0, 0);
    d.setDate(d.getDate() + daysAhead);
    return d.getTime();
  }
  function frames(n, endAt, spanMs, keeps) {
    var out = [];
    for (var i = 1; i <= n; i++) {
      out.push({ n: i, at: Math.round(endAt - spanMs + spanMs * (i / n)),
                 flash: i % 9 === 0, seed: (i * 7919 + n * 131) % 1000000, keeper: keeps.indexOf(i) >= 0 });
    }
    return out;
  }

  if (!localStorage.getItem(K)) {
    var lab = { id: 'r6', no: 6, stock: 'nightbus1600', total: 36, loadedAt: now - day - 6 * hour,
                state: 'lab', push: 1, discreet: false, shared: false,
                sentAt: now - day + 2 * hour, developAt: eight(1),
                frames: frames(36, now - day + 2 * hour, 5 * hour, []) };
    var r5 = { id: 'r5', no: 5, stock: 'meridian100', total: 36, loadedAt: now - 2 * day - 8 * hour,
               state: 'developed', push: 0, discreet: false, shared: false,
               sentAt: now - day - 10 * hour, developAt: eight(0), developedAt: eight(0) + 4 * min,
               frames: frames(36, now - day - 10 * hour, 9 * hour, [3, 7, 12, 19, 24, 31, 35]) };
    var r4 = { id: 'r4', no: 4, stock: 'gullwing', total: 36, loadedAt: now - 5 * day,
               state: 'developed', push: 0, discreet: true, shared: 14,
               sentAt: now - 4 * day, developAt: eight(-3), developedAt: eight(-3) + 3 * min,
               frames: frames(36, now - 4 * day, 30 * hour, [2, 9, 14, 27, 33]) };
    var r3 = { id: 'r3', no: 3, stock: 'riviera50', total: 36, loadedAt: now - 11 * day,
               state: 'developed', push: -1, discreet: false, shared: false,
               sentAt: now - 9 * day, developAt: eight(-8), developedAt: eight(-8) + 5 * min,
               frames: frames(29, now - 9 * day, 40 * hour, [4, 11, 22, 26]) };
    var live = { id: 'r7', no: 7, stock: 'cornerstore400', total: 36, loadedAt: now - 5 * hour,
                 state: 'loaded', push: 0, discreet: false, shared: false,
                 frames: frames(22, now - 12 * min, 4 * hour, []) };
    localStorage.setItem(K, JSON.stringify({
      onboarded: true,
      settings: { developHour: 8, sound: 'full', haptics: true, facing: 'environment' },
      roll: live, rolls: [lab, r5, r4, r3], seq: 7
    }));
  }

  /* A viewfinder needs something in front of it. */
  try {
    var c = window.Scenes.drawNamed('window', 512, 1280);
    var stream = c.captureStream(8);
    navigator.mediaDevices.getUserMedia = function () { return Promise.resolve(stream); };
  } catch (e) {}
})();
"""

SEED_IMAGES = r"""
(async function () {
  if (window.__seeded) return;
  window.__seeded = true;
  const w = ms => new Promise(r => setTimeout(r, ms));
  const state = JSON.parse(localStorage.getItem('contact-sheet.v1'));
  const jobs = [[ 'r5', 'meridian100', 36, 900 ], [ 'r4', 'gullwing', 6, 620 ], [ 'r3', 'riviera50', 6, 620 ]];
  for (const [id, stockId, count, wide] of jobs) {
    const roll = state.rolls.find(r => r.id === id);
    const stock = Stocks.get(stockId);
    for (let i = 1; i <= count; i++) {
      const f = roll.frames.find(x => x.n === i);
      const scene = Scenes.draw(i * 31 + roll.no * 601, wide);
      const cv = document.createElement('canvas');
      cv.width = scene.width; cv.height = scene.height;
      Film.renderTo(cv, scene, stock, { seed: f.seed, frameNo: i, push: roll.push });
      const full = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
      const tc = document.createElement('canvas');
      tc.width = 480; tc.height = 720;
      tc.getContext('2d').drawImage(cv, 0, 0, 480, 720);
      const thumb = await new Promise(r => tc.toBlob(r, 'image/jpeg', 0.85));
      await DB.put(DB.frmKey(id, i), full);
      await DB.put(DB.thmKey(id, i), thumb);
    }
    await w(0);
  }
  App.renderCamera();
})()
"""

WAIT = "const w = ms => new Promise(r => setTimeout(r, ms));"

spec = {
    "url": "http://127.0.0.1:8917/index.html",
    "out": os.path.join(os.path.dirname(HERE), "store", "screenshots"),
    "width": 540, "height": 960, "dpr": 2, "wait": 1400,
    "colorScheme": "dark",
    "seed": SCENES + STATE,
    "shots": [
        {"name": "01-camera", "waitMs": 1200, "before": SEED_IMAGES},
        {"name": "02-sheet", "waitMs": 1100, "before":
         "(async()=>{" + WAIT + " App.show('sheets'); await w(700);"
         " document.querySelectorAll('.rollcard')[1].click(); await w(900);})()"},
        {"name": "03-loupe", "waitMs": 900, "before":
         "(async()=>{" + WAIT + " const g=document.querySelector('#shGrid');"
         " const c=g.querySelectorAll('.cell')[15]; const r=c.querySelector('img').getBoundingClientRect();"
         " const x=r.left+r.width*0.5, y=r.top+r.height*0.55;"
         " const o={pointerId:1,pointerType:'touch',isPrimary:true,bubbles:true,clientX:x,clientY:y};"
         " g.dispatchEvent(new PointerEvent('pointerdown',o)); await w(400);"
         " g.dispatchEvent(new PointerEvent('pointermove',o)); await w(500);})()"},
        {"name": "04-frame", "waitMs": 900, "before":
         "(async()=>{" + WAIT
         + " const g=document.querySelector('#shGrid');"
           " g.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,pointerType:'touch',isPrimary:true,bubbles:true,clientX:0,clientY:0}));"
           " await w(200); await App.openFrame(19); await w(800);})()"},
        {"name": "05-stocks", "waitMs": 900, "before":
         "(async()=>{" + WAIT + " App.show('stocks'); await w(600);})()"},
        {"name": "06-lab", "waitMs": 900, "before":
         "(async()=>{" + WAIT + " App.show('sheets'); await w(800);"
         " document.querySelector('#sheetsList').scrollIntoView();})()"}
    ]
}

out = os.path.join(HERE, "shots.json")
json.dump(spec, open(out, "w", encoding="utf-8"), indent=1)
print("wrote", out, len(json.dumps(spec)), "bytes")
