/* Screenshot scaffolding only. This file is NOT part of the app: it is injected by
   store/shots.json so the store screenshots have something photographic in the
   frames. The frames are still produced by the app's own development pipeline;
   only what was in front of the lens is drawn here instead of photographed. */
window.Scenes = (function () {
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const pick = (r, arr) => arr[(r() * arr.length) | 0];

  function soft(ctx, fn, px) {
    ctx.save();
    if ('filter' in ctx) ctx.filter = 'blur(' + px + 'px)';
    fn();
    ctx.restore();
  }
  function grad(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [p, c] of stops) g.addColorStop(p, c);
    return g;
  }
  function glow(ctx, x, y, r, colour, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, colour);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.284); ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* --- the scenes --- */
  const S = {};

  S.window = (ctx, W, H, r) => {
    ctx.fillStyle = grad(ctx, 0, 0, W, H, [[0, '#4A4137'], [0.6, '#6B5F4E'], [1, '#332C25']]);
    ctx.fillRect(0, 0, W, H);
    const bx = W * lerp(0.16, 0.34, r()), by = H * lerp(0.12, 0.28, r());
    const bw = W * lerp(0.34, 0.5, r()), bh = H * lerp(0.26, 0.4, r());
    soft(ctx, () => {
      ctx.fillStyle = '#F6EAD2';
      ctx.save();
      ctx.transform(1, 0.13, 0, 1, 0, 0);
      ctx.fillRect(bx, by, bw, bh);
      ctx.restore();
    }, 10);
    soft(ctx, () => {
      ctx.fillStyle = 'rgba(246,234,210,0.34)';
      ctx.save(); ctx.transform(1, 0.13, 0, 1, 0, 0);
      ctx.fillRect(bx - 12, by + bh * 0.98, bw * 1.15, bh * 0.7);
      ctx.restore();
    }, 34);
    soft(ctx, () => {
      ctx.fillStyle = 'rgba(22,18,14,0.86)';
      ctx.beginPath();
      const px = W * 0.86, py = H * 0.9;
      for (let i = 0; i < 9; i++) {
        const a = -1.9 + i * 0.34 + r() * 0.1;
        const L = H * (0.2 + r() * 0.3);
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + Math.cos(a) * L * 0.6, py + Math.sin(a) * L * 0.6,
                             px + Math.cos(a) * L, py + Math.sin(a) * L);
        ctx.lineWidth = 26; ctx.strokeStyle = 'rgba(20,17,13,0.9)'; ctx.stroke();
      }
    }, 4);
  };

  S.horizon = (ctx, W, H, r) => {
    const hz = H * lerp(0.55, 0.72, r());
    ctx.fillStyle = grad(ctx, 0, 0, 0, hz, [[0, '#1D3350'], [0.55, '#6E6A83'], [0.85, '#D9885A'], [1, '#F3B673']]);
    ctx.fillRect(0, 0, W, hz);
    const sx = W * lerp(0.2, 0.8, r());
    glow(ctx, sx, hz - H * 0.03, W * 0.55, 'rgba(255,214,150,0.75)', 0.9);
    ctx.fillStyle = '#FFE9C4';
    ctx.beginPath(); ctx.arc(sx, hz - H * 0.035, W * 0.045, 0, 6.284); ctx.fill();
    ctx.fillStyle = grad(ctx, 0, hz, 0, H, [[0, '#241E1B'], [1, '#100D0B']]);
    ctx.beginPath();
    ctx.moveTo(0, hz);
    for (let x = 0; x <= W; x += W / 12) ctx.lineTo(x, hz - Math.sin(x / W * 5 + r()) * H * 0.02 - r() * H * 0.012);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  };

  S.night = (ctx, W, H, r) => {
    ctx.fillStyle = grad(ctx, 0, 0, 0, H, [[0, '#0B0E14'], [1, '#141018']]);
    ctx.fillRect(0, 0, W, H);
    const cols = ['rgba(255,196,110,', 'rgba(255,120,80,', 'rgba(120,190,255,', 'rgba(190,255,210,'];
    const n = 7 + ((r() * 8) | 0);
    for (let i = 0; i < n; i++) {
      const c = pick(r, cols);
      glow(ctx, r() * W, r() * H * 0.85, W * lerp(0.04, 0.16, r()), c + '0.9)', lerp(0.35, 0.95, r()));
    }
    soft(ctx, () => {
      ctx.fillStyle = 'rgba(255,180,110,0.55)';
      const x = W * lerp(0.1, 0.8, r());
      ctx.fillRect(x, H * 0.1, W * 0.02, H * 0.5);
    }, 16);
    ctx.fillStyle = 'rgba(6,6,8,0.92)';
    ctx.fillRect(0, H * lerp(0.72, 0.86, r()), W, H);
  };

  S.figure = (ctx, W, H, r) => {
    ctx.fillStyle = grad(ctx, 0, 0, W, H, [[0, '#D6C8AE'], [0.7, '#A2937B'], [1, '#6B5F4D']]);
    ctx.fillRect(0, 0, W, H);
    const cx = W * lerp(0.34, 0.66, r()), top = H * lerp(0.24, 0.36, r());
    const hr = W * lerp(0.15, 0.2, r());
    soft(ctx, () => {
      ctx.fillStyle = 'rgba(40,32,25,0.35)';
      ctx.beginPath(); ctx.ellipse(cx + hr * 0.6, top + hr * 1.4, hr * 1.5, hr * 1.9, 0, 0, 6.284); ctx.fill();
    }, 40);
    ctx.fillStyle = '#241D17';
    ctx.beginPath(); ctx.arc(cx, top + hr, hr, 0, 6.284); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - hr * 2.1, H);
    ctx.quadraticCurveTo(cx - hr * 1.5, top + hr * 2.1, cx, top + hr * 2.0);
    ctx.quadraticCurveTo(cx + hr * 1.5, top + hr * 2.1, cx + hr * 2.1, H);
    ctx.closePath(); ctx.fill();
    glow(ctx, W * 0.1, H * 0.12, W * 0.5, 'rgba(255,238,206,0.5)', 0.8);
  };

  S.table = (ctx, W, H, r) => {
    ctx.fillStyle = grad(ctx, 0, 0, W, H, [[0, '#8A6E4E'], [0.5, '#6B5236'], [1, '#3B2C1D']]);
    ctx.fillRect(0, 0, W, H);
    glow(ctx, W * lerp(0.05, 0.3, r()), H * 0.08, W * 0.9, 'rgba(255,236,198,0.4)', 0.9);
    const n = 2 + ((r() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const cx = W * lerp(0.2, 0.8, r()), cy = H * lerp(0.35, 0.8, r());
      const rr = W * lerp(0.11, 0.2, r());
      soft(ctx, () => {
        ctx.fillStyle = 'rgba(20,14,8,0.5)';
        ctx.beginPath(); ctx.ellipse(cx + rr * 0.35, cy + rr * 0.3, rr * 1.15, rr * 0.5, 0, 0, 6.284); ctx.fill();
      }, 18);
      ctx.fillStyle = pick(r, ['#E7DFCE', '#D8CDB4', '#2A2622', '#B9A88B']);
      ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.42, 0, 0, 6.284); ctx.fill();
      ctx.strokeStyle = 'rgba(255,246,224,0.55)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cx, cy, rr * 0.92, rr * 0.36, 0, 3.3, 6.0); ctx.stroke();
    }
  };

  S.foliage = (ctx, W, H, r) => {
    ctx.fillStyle = '#16210F';
    ctx.fillRect(0, 0, W, H);
    const greens = ['#2E4A1E', '#3F6127', '#537A32', '#1F3616', '#6B8F3C'];
    for (let i = 0; i < 90; i++) {
      const x = r() * W, y = r() * H, l = W * lerp(0.06, 0.19, r()), a = r() * 6.284;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = pick(r, greens);
      ctx.globalAlpha = lerp(0.5, 1, r());
      ctx.beginPath(); ctx.ellipse(0, 0, l, l * 0.34, 0, 0, 6.284); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 6; i++) glow(ctx, r() * W, r() * H, W * lerp(0.08, 0.2, r()), 'rgba(240,255,190,0.55)', 0.5);
  };

  S.sea = (ctx, W, H, r) => {
    const hz = H * lerp(0.38, 0.52, r());
    ctx.fillStyle = grad(ctx, 0, 0, 0, hz, [[0, '#5C8FC4'], [1, '#C9DCE6']]);
    ctx.fillRect(0, 0, W, hz);
    ctx.fillStyle = grad(ctx, 0, hz, 0, H, [[0, '#3F7C96'], [0.4, '#26596F'], [1, '#123443']]);
    ctx.fillRect(0, hz, W, H - hz);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(0, hz - 2, W, 3);
    for (let i = 0; i < 130; i++) {
      const y = hz + Math.pow(r(), 2) * (H - hz);
      ctx.globalAlpha = lerp(0.1, 0.7, r());
      ctx.fillStyle = '#EAF6FF';
      ctx.fillRect(r() * W, y, lerp(4, 26, r()), 2);
    }
    ctx.globalAlpha = 1;
    glow(ctx, W * lerp(0.2, 0.8, r()), hz * 0.35, W * 0.5, 'rgba(255,246,214,0.6)', 0.8);
  };

  S.stairs = (ctx, W, H, r) => {
    ctx.fillStyle = '#2A2622';
    ctx.fillRect(0, 0, W, H);
    const n = 5 + ((r() * 5) | 0);
    const skew = lerp(-0.4, 0.4, r());
    for (let i = 0; i < n; i++) {
      const y = H * (i / n), h = H / n;
      ctx.save();
      ctx.transform(1, 0, skew, 1, 0, 0);
      ctx.fillStyle = i % 2 ? '#C9BCA4' : '#4A4238';
      ctx.fillRect(-W, y, W * 3, h * 0.62);
      ctx.restore();
    }
    soft(ctx, () => {
      ctx.fillStyle = 'rgba(20,16,12,0.55)';
      ctx.fillRect(0, 0, W * lerp(0.2, 0.5, r()), H);
    }, 30);
    glow(ctx, W * 0.8, H * 0.15, W * 0.6, 'rgba(255,240,205,0.45)', 0.9);
  };

  S.curtain = (ctx, W, H, r) => {
    ctx.fillStyle = '#3A342C';
    ctx.fillRect(0, 0, W, H);
    const folds = 6 + ((r() * 5) | 0);
    for (let i = 0; i < folds; i++) {
      const x = W * (i / folds), w = W / folds;
      const v = lerp(0.25, 1, Math.abs(Math.sin(i * 1.3 + r())));
      ctx.fillStyle = `rgba(${Math.round(226 * v)},${Math.round(212 * v)},${Math.round(182 * v)},1)`;
      ctx.fillRect(x, 0, w + 1, H);
    }
    soft(ctx, () => {
      ctx.fillStyle = 'rgba(10,8,6,0.6)';
      ctx.fillRect(0, H * lerp(0.6, 0.85, r()), W, H);
    }, 40);
  };

  S.road = (ctx, W, H, r) => {
    const hz = H * lerp(0.4, 0.55, r());
    ctx.fillStyle = grad(ctx, 0, 0, 0, hz, [[0, '#7FA4C4'], [1, '#E4D9C2']]);
    ctx.fillRect(0, 0, W, hz);
    ctx.fillStyle = grad(ctx, 0, hz, 0, H, [[0, '#5A544C'], [1, '#26221E']]);
    ctx.fillRect(0, hz, W, H - hz);
    const vx = W * lerp(0.35, 0.65, r());
    ctx.fillStyle = '#3B362F';
    ctx.beginPath();
    ctx.moveTo(vx - W * 0.03, hz); ctx.lineTo(vx + W * 0.03, hz);
    ctx.lineTo(W * 1.25, H); ctx.lineTo(-W * 0.25, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(232,224,196,0.8)';
    ctx.setLineDash([H * 0.05, H * 0.05]);
    ctx.lineWidth = W * 0.014;
    ctx.beginPath(); ctx.moveTo(vx, hz); ctx.lineTo(vx * 1.02, H); ctx.stroke();
    ctx.setLineDash([]);
    glow(ctx, vx, hz, W * 0.4, 'rgba(255,244,214,0.6)', 0.85);
  };

  const NAMES = ['window', 'horizon', 'night', 'figure', 'table', 'foliage', 'sea', 'stairs', 'curtain', 'road'];

  /** One scene onto a fresh canvas at 2:3, deterministic in `seed`. */
  function draw(seed, w) {
    const W = w || 960, H = Math.round(W * 1.5);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const r = rng(seed * 2654435761 + 12345);
    const name = NAMES[Math.abs(seed) % NAMES.length];
    S[name](ctx, W, H, r);
    return c;
  }

  function drawNamed(name, seed, w) {
    const W = w || 960, H = Math.round(W * 1.5);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    S[name](c.getContext('2d'), W, H, rng(seed * 2654435761 + 12345));
    return c;
  }

  return { draw, drawNamed, NAMES, rng };
})();
