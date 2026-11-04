/* except you. — what you see. rain on the glass, grain on everything,
   and the building across the street, drawn one window at a time. */
(function (root) {
  'use strict';

  const V = {
    rainLevel: 1,
    loud: 0,
    dawn: 0,
    phoneGlow: 0,
    reduced: false,
  };

  const DPR = () => Math.min(2, root.devicePixelRatio || 1);
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;

  /* -------------------------------------------------------------- */
  /*  background: rain + grain                                       */
  /* -------------------------------------------------------------- */
  let bg, bctx, drops = [], grainCanvas, grainPattern, bw = 0, bh = 0;

  V.initBackground = function (canvas) {
    bg = canvas;
    bctx = canvas.getContext('2d');
    grainCanvas = document.createElement('canvas');
    grainCanvas.width = grainCanvas.height = 160;
    const g = grainCanvas.getContext('2d');
    const img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainPattern = bctx.createPattern(grainCanvas, 'repeat');
    V.resizeBackground();
    root.addEventListener('resize', V.resizeBackground);
  };

  V.resizeBackground = function () {
    if (!bg) return;
    const d = DPR();
    bw = root.innerWidth; bh = root.innerHeight;
    bg.width = Math.floor(bw * d); bg.height = Math.floor(bh * d);
    bg.style.width = bw + 'px'; bg.style.height = bh + 'px';
    bctx.setTransform(d, 0, 0, d, 0, 0);
    grainPattern = bctx.createPattern(grainCanvas, 'repeat');
  };

  function makeDrop(top) {
    return {
      x: rand(-40, bw + 40),
      y: top ? rand(-bh, 0) : rand(0, bh),
      len: rand(10, 34),
      v: rand(380, 760),
      a: rand(0.04, 0.16),
      w: Math.random() < 0.15 ? 1.4 : 0.8,
    };
  }

  V.drawBackground = function (dt) {
    if (!bctx) return;
    bctx.clearRect(0, 0, bw, bh);

    // the phone, glowing somewhere below you
    if (V.phoneGlow > 0.01) {
      const gr = bctx.createRadialGradient(bw * 0.5, bh * 1.05, 10, bw * 0.5, bh * 1.05, Math.max(bw, bh) * 0.7);
      gr.addColorStop(0, `rgba(150,170,255,${0.07 * V.phoneGlow})`);
      gr.addColorStop(1, 'rgba(150,170,255,0)');
      bctx.fillStyle = gr;
      bctx.fillRect(0, 0, bw, bh);
    }

    // rain
    const target = Math.floor(Math.min(240, (bw * bh) / 7000) * V.rainLevel * (1 + V.loud * 0.8));
    while (drops.length < target) drops.push(makeDrop(true));
    if (drops.length > target) drops.length = Math.max(0, target);
    const slant = 0.13 + V.loud * 0.08;
    const red = V.loud > 0.4 ? (V.loud - 0.4) / 0.6 : 0;
    const r = Math.round(lerp(175, 210, red)), gC = Math.round(lerp(188, 120, red)), b = Math.round(lerp(220, 130, red));
    bctx.lineCap = 'round';
    for (const d of drops) {
      d.y += d.v * dt;
      d.x += d.v * dt * slant;
      if (d.y > bh + 40) Object.assign(d, makeDrop(true), { y: rand(-60, -10) });
      bctx.strokeStyle = `rgba(${r},${gC},${b},${d.a * (0.6 + V.dawn * 0.2)})`;
      bctx.lineWidth = d.w;
      bctx.beginPath();
      bctx.moveTo(d.x, d.y);
      bctx.lineTo(d.x - d.len * slant, d.y - d.len);
      bctx.stroke();
    }

    // grain
    if (grainPattern) {
      bctx.save();
      bctx.globalAlpha = 0.045 + V.loud * 0.05;
      bctx.globalCompositeOperation = 'overlay';
      bctx.translate(Math.random() * 160, Math.random() * 160);
      bctx.fillStyle = grainPattern;
      bctx.fillRect(-160, -160, bw + 320, bh + 320);
      bctx.restore();
    }
  };

  /* -------------------------------------------------------------- */
  /*  drifting fragments of text, behind everything                  */
  /* -------------------------------------------------------------- */
  V.drift = function (layer, text, opts) {
    opts = opts || {};
    const el = document.createElement('span');
    el.className = 'frag' + (opts.loud ? ' frag-loud' : '');
    el.textContent = text;
    const dur = opts.dur || rand(22, 38);
    el.style.left = rand(2, 82) + '%';
    el.style.top = rand(8, 88) + '%';
    el.style.setProperty('--dur', dur + 's');
    el.style.setProperty('--dx', rand(-60, 60) + 'px');
    el.style.setProperty('--dy', rand(-140, -40) + 'px');
    el.style.setProperty('--o', (opts.alpha || rand(0.06, 0.16)).toFixed(3));
    el.style.fontSize = (opts.size || rand(13, 22)) + 'px';
    layer.appendChild(el);
    setTimeout(() => el.remove(), dur * 1000 + 200);
    return el;
  };

  /* -------------------------------------------------------------- */
  /*  the building across the street                                  */
  /* -------------------------------------------------------------- */
  const COLS = ['a', 'b', 'c', 'd'];
  const FLOORS = [6, 5, 4, 3, 2];

  V.layout = function (W, H) {
    const sky = H * 0.09;
    const mx = W * 0.07;
    const cw = (W - mx * 2) / 4;
    const fh = (H - sky - H * 0.06) / 5;
    const rects = {};
    FLOORS.forEach((f, r) => {
      COLS.forEach((c, k) => {
        const ww = cw * 0.6, wh = fh * 0.6;
        const x = mx + k * cw + (cw - ww) / 2;
        const y = sky + r * fh + fh * 0.16;
        rects[f + c] = { x, y, w: ww, h: wh };
      });
    });
    return { sky, mx, cw, fh, rects };
  };

  let facadeCache = null;
  function facade(W, H, L) {
    const key = W + 'x' + H;
    if (facadeCache && facadeCache.key === key) return facadeCache.c;
    const d = DPR();
    const c = document.createElement('canvas');
    c.width = Math.floor(W * d); c.height = Math.floor(H * d);
    const g = c.getContext('2d');
    g.scale(d, d);
    // brick
    const grad = g.createLinearGradient(0, L.sky, 0, H);
    grad.addColorStop(0, '#15151c');
    grad.addColorStop(1, '#0e0e14');
    g.fillStyle = grad;
    g.fillRect(0, L.sky, W, H - L.sky);
    g.strokeStyle = 'rgba(255,255,255,0.025)';
    g.lineWidth = 1;
    const bhgt = 7;
    for (let y = L.sky, row = 0; y < H; y += bhgt, row++) {
      g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke();
      const off = row % 2 ? 0 : 11;
      for (let x = off; x < W; x += 22) {
        g.beginPath(); g.moveTo(x + 0.5, y); g.lineTo(x + 0.5, y + bhgt); g.stroke();
      }
    }
    // roofline
    g.fillStyle = '#0a0a0f';
    g.fillRect(0, L.sky - 4, W, 8);
    // ledges + sills
    for (const id in L.rects) {
      const r = L.rects[id];
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10);
      g.fillStyle = '#1d1d25';
      g.fillRect(r.x - 7, r.y + r.h + 3, r.w + 14, 4);
    }
    // a water tower on the roof, because there always is one
    g.fillStyle = '#0b0b10';
    const tx = W * 0.72;
    g.fillRect(tx, L.sky - 38, 30, 30);
    g.beginPath(); g.moveTo(tx - 3, L.sky - 38); g.lineTo(tx + 15, L.sky - 52); g.lineTo(tx + 33, L.sky - 38); g.fill();
    g.fillRect(tx + 3, L.sky - 8, 3, 8); g.fillRect(tx + 24, L.sky - 8, 3, 8);
    facadeCache = { key, c };
    return c;
  }

  function person(g, x, base, h, o) {
    o = o || {};
    const head = h * 0.13;
    const neck = base - h + head * 2.1;
    const sw = h * (o.wide || 0.4);
    g.beginPath();
    g.ellipse(x + (o.tilt || 0) * head, base - h + head, head * 0.86, head, (o.tilt || 0) * 0.3, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(x - sw / 2, base);
    g.bezierCurveTo(x - sw / 2, neck + h * 0.12, x - sw * 0.38, neck, x - head * 0.55, neck);
    g.lineTo(x + head * 0.55, neck);
    g.bezierCurveTo(x + sw * 0.38, neck, x + sw / 2, neck + h * 0.12, x + sw / 2, base);
    g.closePath();
    g.fill();
    if (o.arm) {
      // a raised hand
      g.lineWidth = Math.max(2, h * 0.07);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x + sw * 0.32, neck + h * 0.1);
      g.lineTo(x + sw * 0.5 + o.arm * h * 0.1, neck - h * 0.28 * o.arm);
      g.stroke();
    }
  }

  function lightFill(g, r, hue, alpha, t, flick) {
    const blue = hue > 180;
    const L1 = blue ? 52 : 66, L2 = blue ? 24 : 34;
    const S = blue ? 45 : 72;
    const gr = g.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.45, 2, r.x + r.w / 2, r.y + r.h * 0.5, r.w * 0.85);
    let a = alpha;
    if (blue) a *= 0.85 + 0.15 * Math.sin(t * 7.3 + r.x) * Math.sin(t * 3.1);
    if (flick) a *= flick;
    gr.addColorStop(0, `hsla(${hue},${S}%,${L1}%,${a})`);
    gr.addColorStop(1, `hsla(${hue},${S - 10}%,${L2}%,${a})`);
    g.fillStyle = gr;
    g.fillRect(r.x, r.y, r.w, r.h);
  }

  function curtains(g, r, hue, alpha) {
    g.fillStyle = `hsla(${hue},40%,18%,${0.55 * alpha})`;
    g.fillRect(r.x, r.y, r.w * 0.14, r.h);
    g.fillRect(r.x + r.w * 0.86, r.y, r.w * 0.14, r.h);
    g.fillStyle = `hsla(${hue},40%,10%,${0.35 * alpha})`;
    g.fillRect(r.x + r.w * 0.05, r.y, r.w * 0.025, r.h);
    g.fillRect(r.x + r.w * 0.92, r.y, r.w * 0.025, r.h);
  }

  const GAP = [0.36, 0.3, 0.2, 0.11];

  function drawPose(g, w, r, t, opts) {
    const st = w.stage || 1;
    const blue = w.hue > 180;
    g.fillStyle = blue ? 'rgba(8,12,24,0.92)' : 'rgba(34,20,12,0.9)';
    g.strokeStyle = g.fillStyle;
    const base = r.y + r.h;
    const cx = r.x + r.w / 2;
    const ph = (r.x * 0.13) % 6.28;
    const sway = V.reduced ? 0 : Math.sin(t * 0.7 + ph) * 1.2;
    const jit = V.loud > 0.5 && !V.reduced ? (Math.random() - 0.5) * V.loud * 3 : 0;
    const gap = GAP[st] * r.w;
    switch (w.pose) {
      case 'pair': {
        const h = r.h * 0.78;
        const tilt = st >= 3 ? 0.35 : 0;
        person(g, cx - gap / 2 + sway + jit, base, h, { tilt });
        person(g, cx + gap / 2 - sway * 0.6 - jit, base, h * 0.94, { tilt: -tilt });
        break;
      }
      case 'sit': {
        const h = r.h * 0.5;
        const tilt = st >= 3 ? 0.4 : 0;
        // the back of a couch
        g.fillRect(r.x + r.w * 0.1, base - r.h * 0.18, r.w * 0.8, r.h * 0.18);
        person(g, cx - gap / 2 + sway * 0.5 + jit, base - r.h * 0.1, h, { tilt });
        person(g, cx + gap / 2 - jit, base - r.h * 0.1, h * 0.95, { tilt: -tilt * 0.5 });
        break;
      }
      case 'screen': {
        const h = r.h * 0.52;
        person(g, cx - r.w * 0.12 + jit, base - r.h * 0.05, h);
        const sx = cx + r.w * 0.08, sy = base - r.h * 0.42, sw = r.w * 0.26, sh = r.h * 0.2;
        g.save();
        g.fillStyle = `rgba(170,200,255,${st >= 3 ? 0.55 : 0.8})`;
        g.fillRect(sx, sy, sw, sh);
        g.fillStyle = 'rgba(20,30,60,0.8)';
        g.beginPath(); g.ellipse(sx + sw / 2, sy + sh * (st >= 3 ? 0.75 : 0.5), sw * 0.12, sh * 0.2, 0, 0, Math.PI * 2); g.fill();
        g.restore();
        break;
      }
      case 'dog': {
        const kneel = st >= 2;
        const h = r.h * (kneel ? 0.55 : 0.78);
        person(g, cx - r.w * 0.12 + sway, base, h);
        // the dog, unimpressed
        const dx = cx + r.w * 0.2, dy = base - r.h * 0.12;
        g.beginPath(); g.ellipse(dx, dy, r.w * 0.11, r.h * 0.07, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(dx + r.w * 0.1, dy - r.h * 0.08, r.w * 0.05, r.h * 0.06, 0, 0, Math.PI * 2); g.fill();
        g.fillRect(dx - r.w * 0.08, dy, r.w * 0.025, r.h * 0.12);
        g.fillRect(dx + r.w * 0.06, dy, r.w * 0.025, r.h * 0.12);
        break;
      }
      case 'baby': {
        const h = r.h * 0.78;
        if (st >= 2) {
          person(g, cx - gap / 2, base, h * (st >= 3 ? 0.5 : 0.95));
          person(g, cx + gap / 2 + sway, base, h);
          g.beginPath(); g.ellipse(cx + gap / 2 + sway - r.w * 0.06, base - h * 0.55, r.w * 0.07, r.h * 0.06, -0.4, 0, Math.PI * 2); g.fill();
        } else {
          const px = cx + Math.sin(t * 0.5) * r.w * 0.2;
          person(g, px, base, h);
          g.beginPath(); g.ellipse(px - r.w * 0.06, base - h * 0.55, r.w * 0.07, r.h * 0.06, -0.4, 0, Math.PI * 2); g.fill();
        }
        break;
      }
      case 'paint': {
        const h = r.h * 0.74;
        // the couch, and someone asleep on it
        g.fillRect(r.x + r.w * 0.45, base - r.h * 0.16, r.w * 0.45, r.h * 0.16);
        g.beginPath(); g.ellipse(r.x + r.w * 0.62, base - r.h * 0.2, r.w * 0.17, r.h * 0.06, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(r.x + r.w * 0.8, base - r.h * 0.24, r.h * 0.06, 0, Math.PI * 2); g.fill();
        person(g, r.x + r.w * 0.25 + sway * 0.4, base, h);
        // the easel
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(r.x + r.w * 0.36, base); g.lineTo(r.x + r.w * 0.42, base - r.h * 0.5);
        g.moveTo(r.x + r.w * 0.48, base); g.lineTo(r.x + r.w * 0.42, base - r.h * 0.5);
        g.stroke();
        g.fillRect(r.x + r.w * 0.34, base - r.h * 0.55, r.w * 0.16, r.h * 0.2);
        break;
      }
      case 'cat': {
        const sx = cx + r.w * 0.05, sy = base - 2;
        g.beginPath(); g.ellipse(sx, sy - r.h * 0.12, r.w * 0.13, r.h * 0.12, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(sx, sy - r.h * 0.3, r.h * 0.08, 0, Math.PI * 2); g.fill();
        g.beginPath();
        g.moveTo(sx - r.h * 0.07, sy - r.h * 0.34); g.lineTo(sx - r.h * 0.06, sy - r.h * 0.46); g.lineTo(sx - r.h * 0.01, sy - r.h * 0.37);
        g.moveTo(sx + r.h * 0.07, sy - r.h * 0.34); g.lineTo(sx + r.h * 0.06, sy - r.h * 0.46); g.lineTo(sx + r.h * 0.01, sy - r.h * 0.37);
        g.fill();
        g.lineWidth = 2.2; g.lineCap = 'round';
        g.beginPath();
        g.moveTo(sx + r.w * 0.11, sy - r.h * 0.04);
        g.quadraticCurveTo(sx + r.w * 0.3, sy, sx + r.w * 0.26 + Math.sin(t * 1.3) * 3, sy - r.h * 0.2);
        g.stroke();
        break;
      }
      case 'lamp': {
        const lx = r.x + r.w * 0.7;
        g.fillRect(lx - 1, base - r.h * 0.45, 2, r.h * 0.45);
        g.beginPath();
        g.moveTo(lx - r.w * 0.09, base - r.h * 0.45); g.lineTo(lx + r.w * 0.09, base - r.h * 0.45);
        g.lineTo(lx + r.w * 0.05, base - r.h * 0.62); g.lineTo(lx - r.w * 0.05, base - r.h * 0.62);
        g.fill();
        break;
      }
      case 'single': {
        const h = r.h * 0.6;
        person(g, cx + jit, base - r.h * 0.04, h, { arm: w.wave || 0 });
        g.save();
        if (w.sign) {
          // a sheet of paper against the glass
          g.fillStyle = 'rgba(236,232,222,0.92)';
          g.fillRect(r.x + r.w * 0.16, r.y + r.h * 0.2, r.w * 0.68, r.h * 0.42);
          g.fillStyle = 'rgba(30,30,40,0.75)';
          for (let k = 0; k < 3; k++) g.fillRect(r.x + r.w * 0.22, r.y + r.h * (0.29 + k * 0.1), r.w * (k === 2 ? 0.34 : 0.56), r.h * 0.04);
        } else {
          // a phone, lighting a face from below
          g.fillStyle = 'rgba(190,210,255,0.7)';
          g.fillRect(cx - r.w * 0.04, base - h * 0.42, r.w * 0.08, r.h * 0.06);
        }
        g.restore();
        break;
      }
    }
  }

  /* opts: { windows: {id:{lit, stage, gone, flick, wave, sign}}, t, selected, loud, dawn, reflection, labels } */
  V.drawBuilding = function (canvas, opts) {
    const g = canvas.getContext('2d');
    const d = DPR();
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return null;
    if (canvas.width !== Math.floor(W * d) || canvas.height !== Math.floor(H * d)) {
      canvas.width = Math.floor(W * d); canvas.height = Math.floor(H * d);
    }
    g.setTransform(d, 0, 0, d, 0, 0);
    const L = V.layout(W, H);
    const t = opts.t || 0;
    const dawn = opts.dawn || 0;

    // sky
    const sky = g.createLinearGradient(0, 0, 0, L.sky + 30);
    sky.addColorStop(0, `rgb(${lerp(9, 58, dawn)},${lerp(10, 52, dawn)},${lerp(20, 88, dawn)})`);
    sky.addColorStop(1, `rgb(${lerp(14, 236, dawn)},${lerp(15, 168, dawn)},${lerp(26, 146, dawn)})`);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, L.sky + 30);

    g.drawImage(facade(W, H, L), 0, 0, W, H);
    if (dawn > 0) {
      g.fillStyle = `rgba(240,170,150,${0.07 * dawn})`;
      g.fillRect(0, L.sky, W, H - L.sky);
    }

    for (const w of root.DATA.windows) {
      const r = L.rects[w.id];
      const s = opts.windows[w.id] || {};
      let jx = 0, jy = 0;
      if (opts.loud > 0.55 && !V.reduced && Math.random() < 0.08) { jx = (Math.random() - 0.5) * 4; jy = (Math.random() - 0.5) * 2; }
      const rr = { x: r.x + jx, y: r.y + jy, w: r.w, h: r.h };
      // glass
      const gl = g.createLinearGradient(rr.x, rr.y, rr.x + rr.w, rr.y + rr.h);
      gl.addColorStop(0, `rgb(${lerp(12, 60, dawn)},${lerp(13, 56, dawn)},${lerp(20, 78, dawn)})`);
      gl.addColorStop(1, `rgb(${lerp(8, 40, dawn)},${lerp(9, 38, dawn)},${lerp(14, 54, dawn)})`);
      g.fillStyle = gl;
      g.fillRect(rr.x, rr.y, rr.w, rr.h);

      if (s.lit && !s.gone) {
        const hue = w.hue || 36;
        const flick = s.flick != null ? s.flick : 1;
        // spill light onto the brick
        g.save();
        g.globalCompositeOperation = 'lighter';
        const glow = g.createRadialGradient(rr.x + rr.w / 2, rr.y + rr.h / 2, rr.w * 0.2, rr.x + rr.w / 2, rr.y + rr.h / 2, rr.w * 1.1);
        glow.addColorStop(0, `hsla(${hue},70%,55%,${0.12 * flick * (1 - dawn * 0.6)})`);
        glow.addColorStop(1, `hsla(${hue},70%,55%,0)`);
        g.fillStyle = glow;
        g.fillRect(rr.x - rr.w, rr.y - rr.h, rr.w * 3, rr.h * 3);
        g.restore();
        lightFill(g, rr, hue, 0.95 * (1 - dawn * 0.35), t, flick);
        if (w.pose !== 'lamp' && w.pose !== 'cat') curtains(g, rr, hue, 1);
        if (s.stage > 0 || w.pose === 'cat' || w.pose === 'lamp' || w.pose === 'single' || opts.allLit) {
          drawPose(g, Object.assign({}, w, { stage: opts.allLit ? 3 : s.stage, wave: s.wave, sign: s.sign }), rr, t, opts);
        } else {
          // you haven't looked yet. there's just movement behind the curtain.
          g.fillStyle = `hsla(${hue},40%,20%,0.45)`;
          const mx = rr.x + rr.w * (0.4 + 0.2 * Math.sin(t * 0.4 + rr.y));
          g.beginPath(); g.ellipse(mx, rr.y + rr.h * 0.62, rr.w * 0.16, rr.h * 0.34, 0, 0, Math.PI * 2); g.fill();
        }
      } else if (w.pose === 'rent') {
        g.fillStyle = 'rgba(220,214,200,0.55)';
        g.fillRect(rr.x + rr.w * 0.28, rr.y + rr.h * 0.38, rr.w * 0.44, rr.h * 0.22);
        g.fillStyle = 'rgba(160,40,40,0.6)';
        g.fillRect(rr.x + rr.w * 0.32, rr.y + rr.h * 0.44, rr.w * 0.36, rr.h * 0.03);
        g.fillRect(rr.x + rr.w * 0.32, rr.y + rr.h * 0.5, rr.w * 0.26, rr.h * 0.03);
      } else if (w.pose === 'dark' && (w.id === '2b' || w.id === '6b')) {
        g.fillStyle = 'rgba(30,26,34,0.9)';
        g.fillRect(rr.x, rr.y, rr.w, rr.h);
      }

      // the glass reflects a little
      g.fillStyle = 'rgba(255,255,255,0.025)';
      g.beginPath();
      g.moveTo(rr.x, rr.y + rr.h * 0.7); g.lineTo(rr.x + rr.w * 0.5, rr.y); g.lineTo(rr.x + rr.w * 0.68, rr.y); g.lineTo(rr.x, rr.y + rr.h);
      g.fill();
      // mullion
      g.fillStyle = '#16161d';
      g.fillRect(rr.x + rr.w / 2 - 1, rr.y, 2, rr.h);

      if (opts.selected === w.id) {
        g.strokeStyle = 'rgba(242,194,123,0.75)';
        g.lineWidth = 1;
        g.strokeRect(rr.x - 3.5, rr.y - 3.5, rr.w + 7, rr.h + 7);
      }
      if (opts.labels !== false) {
        g.font = '500 9px "DM Mono", ui-monospace, monospace';
        g.textAlign = 'left';
        g.fillStyle = s.lit && !s.gone ? 'rgba(220,210,190,0.55)' : 'rgba(150,150,170,0.28)';
        g.fillText(w.id, rr.x - 6, rr.y + rr.h + 18);
        if (w.lines && s.lit && !s.gone) {
          for (let k = 0; k < 3; k++) {
            g.beginPath();
            g.arc(rr.x + rr.w - 12 + k * 6, rr.y + rr.h + 15, 1.7, 0, Math.PI * 2);
            if (k < (s.stage || 0)) { g.fillStyle = 'rgba(242,194,123,0.85)'; g.fill(); }
            else { g.strokeStyle = 'rgba(242,194,123,0.4)'; g.lineWidth = 1; g.stroke(); }
          }
        }
      }
    }

    // your own reflection, in your own window
    if (opts.reflection > 0) {
      g.save();
      g.globalAlpha = opts.reflection;
      g.fillStyle = 'rgba(180,190,215,0.16)';
      person(g, W * 0.5, H + H * 0.06, H * 0.78, { wide: 0.5 });
      g.restore();
    }
    return L;
  };

  root.Visuals = V;
})(window);
