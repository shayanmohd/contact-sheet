/* Contact Sheet. Camera, counter, lab, sheets, shelf, settings.
   The rule the whole file obeys: nothing that came out of the shutter is drawn
   on screen until its roll has developed. */
const App = (() => {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const pad = Store.pad;

  let view = 'camera';
  const stack = [];
  let curRoll = null, curFrame = 0, curStock = null;
  let winding = false, developing = false, pendingStock = null, pendingPush = 0;
  let flashWanted = false, grainUrl = '';

  /* ---------- chrome ---------- */
  let toastTimer = null;
  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms || 2600);
  }

  const MODALS = ['#rewind', '#rollPanel', '#sheetMenu'];
  function openModal(id) { MODALS.forEach(m => { $(m).hidden = m !== id; }); }
  function closeModals() { MODALS.forEach(m => { $(m).hidden = true; }); }
  const modalOpen = () => MODALS.some(m => !$(m).hidden);

  function show(v, push) {
    if (push !== false && v !== view) stack.push(view);
    view = v;
    $$('#stage .screen').forEach(s => { s.hidden = s.id !== 'v-' + v; });
    if (v === 'camera') startCamera(); else Cam.stop();
    if (v === 'sheets') renderSheets();
    if (v === 'sheet') renderSheet();
    if (v === 'stocks') renderShelf();
    if (v === 'settings') renderSettings();
  }
  function go(v) { show(v, true); }

  /* ---------- camera ---------- */
  function makeGrain() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const d = x.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 90 + ((Math.random() * 76) | 0);
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    return c.toDataURL('image/png');
  }

  function fitViewfinder() {
    const shell = $('#vfShell'), wrap = $('#vfWrap');
    if (!shell || !wrap) return;
    const w = shell.clientWidth, h = shell.clientHeight;
    if (!w || !h) return;
    let vw = w, vh = w * 1.5;
    if (vh > h) { vh = h; vw = h / 1.5; }
    wrap.style.width = Math.round(vw) + 'px';
    wrap.style.height = Math.round(vh) + 'px';
  }

  function applyStockHint() {
    const r = Store.roll;
    const vf = $('#vf'), grain = $('#vfGrain');
    if (!r) { vf.style.filter = 'grayscale(1) brightness(.35)'; grain.style.opacity = 0; return; }
    const s = Stocks.get(r.stock);
    vf.style.filter = s.hint;
    grain.style.backgroundImage = `url(${grainUrl})`;
    grain.style.opacity = String(Math.min(0.30, 0.07 + s.grain.amp * 1.7));
  }

  function camState() {
    const box = $('#vfState'), txt = $('#vfStateText'), retry = $('#vfRetry');
    const s = Cam.state;
    if (!Store.roll) { box.hidden = true; return; }
    if (s === 'ready') { box.hidden = true; return; }
    box.hidden = false;
    retry.hidden = s !== 'denied';
    txt.textContent =
      s === 'starting' ? 'Opening the back.' :
      s === 'denied' ? 'Contact Sheet needs the camera to take a photograph. Nothing it sees leaves this device: there is no internet permission in the app at all.' :
      s === 'missing' ? 'This device has no camera the browser can reach.' :
      'The camera did not open.';
  }

  async function startCamera() {
    fitViewfinder();
    applyStockHint();
    if (!Store.roll) { Cam.stop(); camState(); renderCamera(); return; }
    if (Cam.live) { camState(); return; }
    await Cam.start(Store.settings().facing);
    camState();
    renderCamera();
  }

  function renderCamera() {
    const r = Store.roll;
    const n = Store.left();
    $('#cStock').textContent = r ? Stocks.get(r.stock).name.toUpperCase() : 'No roll';
    $('#cNum').textContent = r ? pad(n) : '--';
    $('#cNum').classList.toggle('low', !!r && n <= 6);
    $('#cCap').textContent = r ? (n === 1 ? 'frame left' : 'frames left') : 'loaded';
    $('#emptyCam').hidden = !!r;
    $('#controls').hidden = !r;
    $('#flashBtn').classList.toggle('on', flashWanted && Cam.torchOn);
    $('#shutterBtn').disabled = !(r && n > 0 && Cam.live && !winding);
  }

  function bladeFlash() {
    const wrap = $('#vfWrap');
    let el = wrap.querySelector('.shot-flash');
    if (!el) { el = document.createElement('div'); el.className = 'shot-flash'; wrap.appendChild(el); }
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
  }

  /** 1.2 seconds of ratchet. The pacing of the whole app lives in this function. */
  function windOn(ms) {
    return new Promise(res => {
      const bar = $('#ratchet'), box = $('#windOn');
      const dur = ms || 1200;
      box.hidden = false;
      bar.style.transition = 'none';
      bar.style.width = '0%';
      void bar.offsetWidth;
      bar.style.transition = `width ${dur}ms cubic-bezier(.5,.02,.72,1)`;
      bar.style.width = '100%';
      Sound.windOn(dur);
      Sound.hWind();
      setTimeout(() => { box.hidden = true; res(); }, dur + 60);
    });
  }

  async function fire() {
    const r = Store.roll;
    if (winding || !r || Store.left() <= 0 || !Cam.live) return;
    winding = true;
    renderCamera();
    Sound.wake();
    Sound.shutter();
    Sound.hShutter();
    bladeFlash();

    let blob = null;
    try { blob = await Cam.capture(Store.settings().facing); } catch (e) { blob = null; }
    if (!blob) {
      winding = false; renderCamera();
      toast('The camera did not give a frame. Nothing was used up.');
      return;
    }
    const f = Store.recordFrame({ flash: flashWanted && Cam.torchOn, discreet: Store.settings().sound === 'discreet' });
    if (!f) { winding = false; renderCamera(); return; }
    try { await DB.put(DB.negKey(r.id, f.n), blob); }
    catch (e) { toast('This device would not store the frame.'); }

    if (Store.left() === 0) {
      winding = false;
      renderCamera();
      handIn(r, 'Rewinding');
      return;
    }
    await windOn(1200);
    winding = false;
    renderCamera();
  }

  /* ---------- the counter at the lab ---------- */
  function handIn(roll, kicker) {
    pendingPush = 0;
    $('#rwK').textContent = kicker;
    $('#rwH').textContent = `Roll ${pad(roll.no)}. ${roll.frames.length} exposure${roll.frames.length === 1 ? '' : 's'} on ${Stocks.get(roll.stock).name}.`;
    $('#rwLab').hidden = true;
    openModal('#rewind');
    Sound.rewind();
    Sound.hRewind();
    setPushSeg(0);
    setTimeout(() => {
      $('#rwK').textContent = 'At the counter';
      $('#rwLab').hidden = false;
    }, 2200);
  }

  const PUSH_HELP = {
    '-1': 'Pull one stop. Gentler contrast, finer grain, and highlights that hold on longer.',
    '0': 'Develop it normally. The stock does what the box says.',
    '1': 'Push one stop. Brighter, harder, grainier. Good for a roll you shot in bad light.'
  };
  function setPushSeg(v) {
    pendingPush = v;
    $$('#pushSeg button').forEach(b => b.classList.toggle('on', Number(b.dataset.v) === v));
    $('#pushHelp').textContent = PUSH_HELP[String(v)];
  }

  function commitHandIn() {
    const r = Store.sendToLab();
    closeModals();
    if (!r) return;
    Store.setPush(r.id, pendingPush);
    scheduleNotifications();
    const line = `Roll ${pad(r.no)} is at the lab. Back ${Store.backLine(r.developAt)}.`;
    if (pendingStock) {
      const s = pendingStock; pendingStock = null;
      doLoad(s);
      toast(line, 4200);
    } else {
      show('camera', false);
      renderCamera();
      toast(line, 4600);
    }
  }

  /* ---------- loading a roll ---------- */
  function requestLoad(stockId) {
    if (Store.roll && Store.roll.frames.length > 0) {
      pendingStock = stockId;
      handIn(Store.roll, 'Rewinding');
      return;
    }
    if (Store.roll) Store.unload();   // an unexposed roll just comes back out
    doLoad(stockId);
  }

  async function doLoad(stockId) {
    Store.loadRoll(stockId);
    scheduleNotifications();
    show('camera', false);
    renderCamera();
    applyStockHint();
    Sound.wake();
    Sound.cartridge();
    Sound.hLoad();
    setTimeout(() => windOn(900), 260);
    renderCamera();
    toast(`${Stocks.get(stockId).name} loaded. 36 exposures.`, 3200);
  }

  /* ---------- the lab ---------- */
  async function checkLab() {
    if (developing) return false;
    const dueRolls = Store.due();
    if (!dueRolls.length) return false;
    developing = true;
    Cam.stop();
    show('lab', false);
    let last = dueRolls[0];                       // newest roll: the one to open afterwards
    for (const r of dueRolls.slice().reverse()) {  // develop oldest first, the way a batch runs
      $('#labRoll').textContent = `Roll ${pad(r.no)}`;
      $('#labN').textContent = `0 of ${r.frames.length}`;
      $('#labFill').style.width = '0%';
      await new Promise(res => setTimeout(res, 500));
      await Film.developRoll(r, (d, t) => {
        $('#labFill').style.width = Math.round(d / t * 100) + '%';
        $('#labN').textContent = `${d} of ${t}`;
      });
    }
    developing = false;
    Sheet.forget();
    Sound.wake();
    Sound.envelope();
    scheduleNotifications();
    if (last) {
      curRoll = Store.byId(last.id);
      stack.length = 0;
      stack.push('camera', 'sheets');
      show('sheet', false);
      toast(`Roll ${pad(last.no)} is back. ${last.frames.length} exposures.`, 4200);
    } else {
      show('camera', false);
    }
    return true;
  }

  /* ---------- sheets archive ---------- */
  async function renderSheets() {
    const list = $('#sheetsList');
    const rolls = Store.rolls;
    list.innerHTML = '';
    $('#sheetsEmpty').hidden = rolls.length > 0;
    for (const r of rolls) {
      const s = Stocks.get(r.stock);
      const card = document.createElement('button');
      card.className = 'rollcard' + (r.state === 'lab' ? ' waiting' : '');
      const kept = Store.keepers(r).length;
      if (r.state === 'lab') {
        card.innerHTML =
          `<div class="rc-top"><span class="rc-stock">${s.name}</span><span class="rc-no">Roll ${pad(r.no)}</span></div>` +
          `<p class="rc-meta">${r.frames.length} exposure${r.frames.length === 1 ? '' : 's'}. ${Store.dateSpan(r)}.</p>` +
          `<div class="rc-wait"><span class="rc-back">At the lab</span><span class="dashes"></span>` +
          `<span class="rc-no">${Store.countdown(r.developAt)}</span></div>` +
          `<p class="rc-meta">Back ${Store.backLine(r.developAt)}.</p>`;
        card.onclick = () => toast(`Roll ${pad(r.no)} comes back ${Store.backLine(r.developAt)}. Nothing to see until then.`, 3600);
      } else {
        const urls = await Sheet.strip(r, 6);
        card.innerHTML =
          `<div class="rc-top"><span class="rc-stock">${s.name}</span><span class="rc-no">Roll ${pad(r.no)}</span></div>` +
          `<div class="rc-strip">${urls.map(u => `<img alt=""${u ? ` src="${u}"` : ''}>`).join('')}</div>` +
          `<p class="rc-meta">${r.frames.length} exposures. ${Store.dateSpan(r)}. ` +
          `<span class="${kept ? 'rc-kept' : ''}">${kept ? kept + ' kept' : 'none kept'}</span></p>`;
        card.onclick = () => { curRoll = r; go('sheet'); };
      }
      list.appendChild(card);
    }
  }

  /* ---------- one sheet ---------- */
  async function renderSheet() {
    const r = curRoll && Store.byId(curRoll.id);
    if (!r) { show('sheets', false); return; }
    curRoll = r;
    const s = Stocks.get(r.stock);
    $('#shTitle').textContent = 'Roll ' + pad(r.no);
    $('#shStock').textContent = s.name.toUpperCase();
    $('#shMeta').textContent = `${r.frames.length} exposures. ${Store.dateSpan(r)}. Developed ${Store.clockTime(r.developedAt || r.developAt)}.`;
    const marks = [];
    if (r.push > 0) marks.push('Push +1');
    if (r.push < 0) marks.push('Pull -1');
    if (r.discreet) marks.push('Discreet');
    $('#shMarks').textContent = marks.join('   ');
    $('#shMarks').hidden = !marks.length;
    updateKept();
    await Sheet.renderGrid(r, $('#shGrid'));
    requestAnimationFrame(() => Sheet.fitGrid($('#shGrid'), $('#shScroll'), 288));
  }
  function updateKept() {
    const r = curRoll && Store.byId(curRoll.id);
    if (!r) return;
    const k = Store.keepers(r).length;
    const el = $('#shKept');
    el.textContent = k ? `${k} kept of ${r.frames.length}` : 'Nothing kept yet';
    el.classList.toggle('some', k > 0);
  }

  /* ---------- one frame ---------- */
  async function openFrame(n) {
    const r = curRoll && Store.byId(curRoll.id);
    if (!r) return;
    curFrame = n;
    const f = r.frames.find(x => x.n === n);
    if (!f) return;
    const s = Stocks.get(r.stock);
    $('#frTitle').textContent = `Frame ${pad(n)}`;
    $('#frStock').textContent = s.name;
    $('#frMeta').textContent = `${Store.longDate(f.at)}   ${Store.clockTime(f.at)}   Roll ${pad(r.no)}`;
    const url = await DB.url(DB.frmKey(r.id, n));
    $('#frImg').src = url || '';
    $('#frPencilPath').setAttribute('d', Sheet.pencilPath(n));
    paintFrameButtons();
    go('frame');
  }
  function paintFrameButtons() {
    const r = curRoll && Store.byId(curRoll.id);
    if (!r) return;
    const f = r.frames.find(x => x.n === curFrame);
    const kept = !!(f && f.keeper);
    $('#frKeep').textContent = kept ? 'Kept' : 'Keep';
    $('#frKeep').classList.toggle('on', kept);
    $('#frPencil').style.opacity = kept ? '1' : '0';
    const share = $('#frShare');
    const used = r.shared && r.shared !== curFrame;
    share.disabled = false;
    share.textContent = used ? `Frame ${pad(r.shared)} was sent` : (r.shared === curFrame ? 'Send it again' : 'Share this one');
  }

  /* ---------- the shelf ---------- */
  function boxHtml(s, rear) {
    const m = s.name.match(/^(.*?)\s+(\d+)$/);
    const nm = (m ? m[1] : s.name).toUpperCase();
    const num = m ? m[2] : String(s.iso);
    const kind = s.mono ? 'B&W negative' : s.sat > 1.2 ? 'Colour reversal' : 'Colour negative';
    const vars = `--paper:${s.box.paper};--ink:${s.box.ink};--band:${s.box.band}`;
    if (!rear) {
      return `<div class="box" data-style="${s.box.style}" style="${vars}">` +
        `<div class="b-band"></div><div class="b-name">${nm}</div>` +
        `<div class="b-iso">${num}</div>` +
        `<div class="b-foot">36 exp   ${kind}</div></div>`;
    }
    const rows = Stocks.spec(s).map(([k, v]) => `<div class="r-row"><b>${k}</b><span>${v}</span></div>`).join('');
    return `<div class="box rear" data-style="${s.box.style}" style="${vars}">` +
      `<div class="r-h">${nm} ${num}</div>${rows}<div class="r-h">${s.line}</div></div>`;
  }

  function renderShelf() {
    const shelf = $('#shelf');
    shelf.innerHTML = '';
    for (const s of Stocks.LIST) {
      const b = document.createElement('button');
      const inCamera = Store.roll && Store.roll.stock === s.id;
      b.innerHTML = boxHtml(s) +
        `<span class="under${inCamera ? ' loaded' : ''}">${inCamera ? 'In the camera' : s.line}</span>`;
      b.onclick = () => { curStock = s; renderStock(); go('stock'); };
      shelf.appendChild(b);
    }
  }

  function renderStock() {
    const s = curStock;
    if (!s) return;
    $('#stTitle').textContent = s.name;
    $('#stIso').textContent = 'ISO ' + s.iso;
    const box = $('#stBox');
    box.classList.remove('flip');
    box.innerHTML = `<div class="face front">${boxHtml(s)}</div><div class="face back">${boxHtml(s, true)}</div>`;
    box.onclick = () => { box.classList.toggle('flip'); Sound.tick(); Sound.hTap(); };
    $('#stNote').textContent = s.note;
    $('#stSpecs').innerHTML = Stocks.spec(s)
      .map(([k, v]) => `<div class="row"><span class="k2">${k}</span><span class="v">${v}</span></div>`).join('');
    drawCurve(s);
    const loaded = Store.roll && Store.roll.stock === s.id;
    const busy = Store.roll && Store.roll.frames.length > 0;
    $('#stLoad').textContent = loaded ? 'Already in the camera' : 'Load this roll';
    $('#stLoad').disabled = !!loaded;
    const warn = $('#stWarn');
    warn.hidden = !(busy && !loaded);
    if (!warn.hidden) {
      warn.textContent = `There is a roll in the camera with ${Store.roll.frames.length} exposure${Store.roll.frames.length === 1 ? '' : 's'} on it. Loading this one hands that roll in as it stands. The frames are not given back.`;
    }
  }

  function drawCurve(s) {
    const W = 260, H = 150, P = 14;
    const pts = Film.curvePoints(s, 40);
    const line = (arr, colour) => {
      const d = arr.map((v, i) => {
        const x = P + (W - P * 2) * (i / (arr.length - 1));
        const y = H - P - (H - P * 2) * v;
        return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }).join(' ');
      return `<path class="ln" d="${d}" stroke="${colour}"/>`;
    };
    let g = `<line class="ax" x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}"/>` +
            `<line class="ax" x1="${P}" y1="${P}" x2="${P}" y2="${H - P}"/>` +
            `<line class="ax" x1="${P}" y1="${H - P}" x2="${W - P}" y2="${P}" stroke-dasharray="3 4"/>`;
    if (pts.y) g += line(pts.y, '#D6CDBC');
    else {
      g += line(pts.b, '#5C86C8');
      g += line(pts.g, '#69B183');
      g += line(pts.r, '#D4695C');
    }
    $('#stCurve').innerHTML = g;
  }

  /* ---------- settings ---------- */
  async function renderSettings() {
    const st = Store.settings();
    $('#setHour').value = String(st.developHour);
    $$('#setSound button').forEach(b => b.classList.toggle('on', b.dataset.v === st.sound));
    $('#setHaptics').checked = !!st.haptics;
    const hasNotify = !!(window.Native && window.Native.scheduleNotifications);
    $('#notifyField').hidden = !hasNotify;
    if (hasNotify) {
      let ok = true;
      try { ok = window.Native.notificationsAllowed(); } catch (e) {}
      $('#notifyState').textContent = ok
        ? 'On. You get one notice per roll, the morning it comes back.'
        : 'Off. Without it the roll still develops, but only once you open the app.';
      $('#notifyBtn').hidden = ok;
    }
    try {
      const bytes = await DB.usage();
      const mb = bytes / 1048576;
      const rolls = Store.rolls.length + (Store.roll ? 1 : 0);
      $('#usageLine').textContent =
        `${rolls} roll${rolls === 1 ? '' : 's'} on this device, using ${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB.`;
    } catch (e) { $('#usageLine').textContent = 'Storage size is not readable here.'; }
  }

  function scheduleNotifications() {
    if (!(window.Native && window.Native.scheduleNotifications)) return;
    try { window.Native.scheduleNotifications(JSON.stringify(Store.notifications())); } catch (e) {}
  }

  /* ---------- wiring ---------- */
  function bind() {
    $$('[data-back]').forEach(b => { b.onclick = () => { if (!back()) show('camera', false); }; });

    $('#covGo').onclick = () => { Sound.wake(); Store.onboarded(true); stack.length = 0; go('stocks'); };

    $('#toSheets').onclick = () => go('sheets');
    $('#toStocks').onclick = () => go('stocks');
    $('#toSettings').onclick = () => go('settings');
    $('#emptyLoad').onclick = () => { Sound.wake(); go('stocks'); };
    $('#vfRetry').onclick = () => startCamera();

    $('#shutterBtn').onclick = () => fire();
    $('#flashBtn').onclick = async () => {
      if (!Cam.live) return;
      if (!Cam.hasTorch) { toast('This camera has no flash to switch on.'); return; }
      flashWanted = !flashWanted;
      await Cam.torch(flashWanted);
      Sound.hTap();
      renderCamera();
    };
    $('#faceBtn').onclick = async () => {
      const st = Store.settings();
      const next = st.facing === 'user' ? 'environment' : 'user';
      Store.settings({ facing: next });
      flashWanted = false;
      Sound.hTap();
      await Cam.start(next);
      camState(); renderCamera();
    };

    $('#rollBtn').onclick = () => {
      const r = Store.roll;
      if (!r) { go('stocks'); return; }
      const s = Stocks.get(r.stock);
      $('#rpStock').textContent = s.name;
      $('#rpMeta').textContent = r.frames.length
        ? `${r.frames.length} of 36 exposed. Loaded ${Store.longDate(r.loadedAt)}. Handing it in now sends what you have shot, and the rest of the roll is gone.`
        : `Nothing on it yet. Loaded ${Store.longDate(r.loadedAt)}. An unexposed roll simply comes back out of the camera.`;
      $('#rpHand').textContent = r.frames.length ? 'Hand it in unfinished' : 'Take the roll out';
      openModal('#rollPanel');
    };
    $('#rpClose').onclick = closeModals;
    $('#rpNew').onclick = () => { closeModals(); go('stocks'); };
    $('#rpHand').onclick = () => {
      const r = Store.roll;
      closeModals();
      if (!r) return;
      if (!r.frames.length) {
        Store.unload();
        show('camera', false); renderCamera();
        toast('The roll came out unexposed. Nothing was used up.', 3400);
        return;
      }
      handIn(r, 'Rewinding');
    };

    $$('#pushSeg button').forEach(b => { b.onclick = () => { Sound.hTap(); setPushSeg(Number(b.dataset.v)); }; });
    $('#rwGo').onclick = commitHandIn;

    $('#stLoad').onclick = () => { if (curStock) requestLoad(curStock.id); };

    $('#shGrid').__onOpen = n => openFrame(n);
    Sheet.attachLoupe($('#shGrid'), $('#loupe'), $('#loupeCv'), () => curRoll);

    $('#shSave').onclick = () => saveSheet();
    $('#shMenu').onclick = () => {
      const r = curRoll && Store.byId(curRoll.id);
      if (!r) return;
      $('#smTitle').textContent = `Roll ${pad(r.no)}, ${Stocks.get(r.stock).name}`;
      openModal('#sheetMenu');
    };
    $('#smClose').onclick = closeModals;
    $('#smSave').onclick = () => { closeModals(); saveSheet(); };
    $('#smDelete').onclick = async () => {
      const btn = $('#smDelete');
      if (!btn.dataset.armed) {
        btn.dataset.armed = '1';
        btn.textContent = 'Tap again. This cannot be undone';
        setTimeout(() => { delete btn.dataset.armed; btn.textContent = 'Throw this roll away'; }, 4000);
        return;
      }
      const r = curRoll;
      closeModals();
      delete btn.dataset.armed;
      btn.textContent = 'Throw this roll away';
      await DB.delPrefix('frm:' + r.id + ':');
      await DB.delPrefix('thm:' + r.id + ':');
      await DB.delPrefix('neg:' + r.id + ':');
      Store.forgetRoll(r.id);
      Sheet.forget();
      curRoll = null;
      show('sheets', false);
      toast(`Roll ${pad(r.no)} is gone.`);
    };

    $('#frKeep').onclick = () => {
      const r = curRoll && Store.byId(curRoll.id);
      if (!r) return;
      const on = Store.toggleKeeper(r.id, curFrame);
      Sound.tick(); Sound.hTap();
      const svg = $('#frPencil');
      svg.classList.remove('draw');
      if (on) { void svg.offsetWidth; svg.classList.add('draw'); }
      paintFrameButtons();
      updateKept();
    };
    $('#frSave').onclick = async () => {
      const r = curRoll && Store.byId(curRoll.id);
      if (!r) return;
      const blob = await DB.get(DB.frmKey(r.id, curFrame));
      if (!blob) { toast('That frame is not on the device any more.'); return; }
      const name = `contact-sheet-roll${pad(r.no)}-frame${pad(curFrame)}.jpg`;
      const res = await Export.save(name, blob);
      toast(res ? 'Frame saved at full size.' : 'Saving did not work here.');
    };
    $('#frShare').onclick = async () => {
      const r = curRoll && Store.byId(curRoll.id);
      if (!r) return;
      if (r.shared && r.shared !== curFrame) {
        toast(`One frame per roll leaves this app, and you already sent frame ${pad(r.shared)}. Save the others instead.`, 4200);
        return;
      }
      toast('Making the frame.');
      const blob = await Export.frameCard(r, curFrame);
      const name = `contact-sheet-roll${pad(r.no)}-frame${pad(curFrame)}-card.jpg`;
      const res = await Export.share(name, blob, 'A frame from Contact Sheet');
      if (res === 'cancelled') return;
      if (res) { Store.markShared(r.id, curFrame); paintFrameButtons(); }
      toast(res === 'shared' ? 'Sent.' : res ? 'Saved where your downloads go.' : 'Sharing did not work here.');
    };

    $('#setHour').onchange = e => { Store.settings({ developHour: Number(e.target.value) }); scheduleNotifications(); };
    $$('#setSound button').forEach(b => {
      b.onclick = () => { Store.settings({ sound: b.dataset.v }); Sound.wake(); Sound.tick(); Sound.hTap(); renderSettings(); };
    });
    $('#setHaptics').onchange = e => { Store.settings({ haptics: e.target.checked }); Sound.hTap(); };
    $('#notifyBtn').onclick = () => {
      try { window.Native.requestNotificationPermission(); } catch (e) {}
      setTimeout(renderSettings, 1400);
    };
    $('#eraseBtn').onclick = async () => {
      const btn = $('#eraseBtn');
      if (!btn.dataset.armed) {
        btn.dataset.armed = '1';
        btn.textContent = 'Tap again to erase everything';
        setTimeout(() => { delete btn.dataset.armed; btn.textContent = 'Erase everything'; }, 4000);
        return;
      }
      await DB.clear();
      Store.erase();
      location.reload();
    };

    window.addEventListener('resize', () => {
      fitViewfinder();
      if (view === 'sheet') Sheet.fitGrid($('#shGrid'), $('#shScroll'), 288);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) onPause(); else onResume();
    });
    document.addEventListener('pointerdown', () => Sound.wake(), { once: true });
  }

  async function saveSheet() {
    const r = curRoll && Store.byId(curRoll.id);
    if (!r) return;
    toast('Printing the sheet.');
    const blob = await Export.sheet(r);
    const res = await Export.save(`contact-sheet-roll${pad(r.no)}.jpg`, blob);
    toast(res === 'download' ? 'Sheet downloaded.' : res ? 'Sheet saved where your downloads go.' : 'Saving did not work here.');
  }

  /* ---------- lifecycle ---------- */
  async function init() {
    grainUrl = makeGrain();
    Cam.attach($('#vf'));
    bind();
    Cam.on(() => { if (view === 'camera') { camState(); renderCamera(); } });
    fitViewfinder();
    if (!Store.onboarded()) { show('covenant', false); return; }
    scheduleNotifications();
    if (await checkLab()) return;
    show('camera', false);
    renderCamera();
  }

  function back() {
    if (modalOpen()) { closeModals(); return true; }
    if (view === 'lab') return true;
    if (view === 'covenant') return false;
    if (stack.length) { show(stack.pop(), false); return true; }
    if (view !== 'camera') { show('camera', false); return true; }
    return false;
  }
  function onPause() { Cam.stop(); }
  async function onResume() {
    if (!Store.onboarded()) return;
    scheduleNotifications();
    if (await checkLab()) return;
    if (view === 'camera') startCamera();
    if (view === 'sheets') renderSheets();
  }

  document.addEventListener('DOMContentLoaded', init);
  return { back, onPause, onResume, show: go, toast, checkLab, openFrame, renderCamera };
})();

// A top-level const does not become a property of window in a classic script, and
// the Android shell looks for window.App to hand the Back gesture to.
window.App = App;
