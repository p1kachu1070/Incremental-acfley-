/* except you. — the edit. thirty seconds, 72 bpm, cut on the beat.
   An original slowed + reverb song (Edit.score) and the picture cut to it (Edit.draw).
   The hook melody sings the rhythm of "a-ny-bo-dy can find love" and lands on vi at "except you". */
(function (root) {
  'use strict';

  const D = root.DATA, V = root.Visuals, S = root.Sound;
  const { hash, smooth, seg, words, grain, rain } = root.Clip.util;
  const W = 1080, H = 1920, FPS = 30;
  const BPM = 72, B = 60 / BPM, BAR = 4 * B;
  const DROP = 2 * BAR, BREAK = 5 * BAR, BACK = 6 * BAR, SIX = 7 * BAR, HOME = 8 * BAR;
  const DURATION = 9 * BAR, LEAD = 0.5;
  const Edit = { W, H, FPS, DURATION, LEAD, BPM };
  const TAU = Math.PI * 2;
  const lerp = (a, b, k) => a + (b - a) * k;

  const SERIF = '"Instrument Serif", Georgia, serif';
  const MONTAGE = ['2c', '3a', '4a', '2a', '3d', '4c', '5d', '6a', '3b', '2d', '6c', '5b'];
  const LIGHTS_OUT = ['5b', '2a', '6c', '3d', '4a', '2c', '5d', '3a', '6a', '3b', '4c', '2d', '5a', '3c'];
  const L = V.layout(W, H);
  const MONTAGE_ZOOM = 4.7;

  /* ============================================================== */
  /*  the song                                                       */
  /* ============================================================== */
  Edit.score = function (t0) {
    const A = S, ctx = A.ctx;
    const T = x => t0 + LEAD + x;
    const at = (bar, beat) => T(bar * BAR + beat * B);
    A.transpose = -2;

    A.rain.gain.cancelScheduledValues(t0);
    A.rain.gain.setValueAtTime(0.06, t0);
    A.rain.gain.setValueAtTime(0.06, T(BREAK));
    A.rain.gain.linearRampToValueAtTime(0.16, T(BREAK + 0.4));
    A.rain.gain.setValueAtTime(0.16, T(BACK - 0.5));
    A.rain.gain.linearRampToValueAtTime(0.07, T(BACK + 1));
    A.room.gain.setValueAtTime(0.06, t0);
    A.pad.gain.cancelScheduledValues(t0);
    A.pad.gain.setValueAtTime(0.4, t0);
    A.padLP.frequency.setValueAtTime(1500, t0);
    A.wobbleDepth.gain.setValueAtTime(8, t0);
    A.wobble.frequency.setValueAtTime(0.42, t0);

    // the song through a wall, then the wall comes down at the drop
    const LP = A.musicLP.frequency;
    LP.setValueAtTime(380, t0);
    LP.setValueAtTime(380, T(DROP - 1.8));
    LP.exponentialRampToValueAtTime(1500, T(DROP - 0.04));
    LP.setValueAtTime(3800, T(DROP));
    LP.setValueAtTime(3800, T(BREAK - 0.02));
    LP.exponentialRampToValueAtTime(150, T(BREAK + 0.35));
    LP.setValueAtTime(150, T(BACK - 0.7));
    LP.exponentialRampToValueAtTime(1000, T(BACK + 0.5));
    LP.exponentialRampToValueAtTime(2400, T(HOME));

    // buses
    const drums = ctx.createGain();
    drums.gain.value = 0.85;
    drums.connect(A.dry);
    const drumVerb = ctx.createGain();
    drumVerb.gain.value = 0.26;
    drums.connect(drumVerb); drumVerb.connect(A.verbIn);
    const lead = ctx.createGain();
    const leadDry = ctx.createGain(); leadDry.gain.value = 0.38;
    const leadWet = ctx.createGain(); leadWet.gain.value = 1;
    lead.connect(leadDry); leadDry.connect(A.dry);
    lead.connect(leadWet); leadWet.connect(A.verbIn);

    const noise = (t, dur, type, freq, q, vol, dest, decay) => {
      const src = ctx.createBufferSource();
      src.buffer = A._noise;
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0005, t + (decay || dur));
      src.connect(f); f.connect(g); g.connect(dest);
      src.start(t, Math.random() * 2, dur + 0.05);
    };
    const kick = (t, v) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(44, t + 0.16);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.95 * v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.42);
      o.connect(g); g.connect(drums);
      o.start(t); o.stop(t + 0.45);
      noise(t, 0.012, 'highpass', 2000, 0.7, 0.12 * v, drums);
    };
    const snare = (t, v) => {
      noise(t, 0.3, 'bandpass', 1900, 0.7, 0.55 * v, drums, 0.24);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(200, t);
      o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.3 * v, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.13);
      o.connect(g); g.connect(drums);
      o.start(t); o.stop(t + 0.15);
    };
    const hat = (t, v) => noise(t, 0.05, 'highpass', 7200, 0.7, 0.13 * v, drums, 0.045);
    const bassNote = (n, t, dur, v) => {
      const f = 440 * Math.pow(2, (n + A.transpose - 69) / 12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.42 * v, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.12 * v, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      g.connect(lp); lp.connect(A.music);
      [['sine', 1], ['triangle', 0.35]].forEach(([type, k]) => {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
        const kg = ctx.createGain(); kg.gain.value = k;
        o.connect(kg); kg.connect(g); o.start(t); o.stop(t + dur + 0.05);
      });
    };

    // vinyl: dust, and a little hiss
    {
      const rate = ctx.sampleRate, len = rate * 2;
      const buf = ctx.createBuffer(1, len, rate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * 0.015;
        if (Math.random() < 0.0007) { const amp = (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.7); for (let k = 0; k < 24 && i + k < len; k++) d[i + k] += amp * Math.exp(-k / 4); }
      }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.09, t0);
      src.connect(hp); hp.connect(g); g.connect(A.dry);
      src.start(t0);
    }

    const CH = { IV: [53, 57, 60, 64], V: [55, 59, 62, 65], iii: [52, 55, 59, 62], vi: [57, 60, 64, 67], I: [55, 60, 64, 71] };
    const ROOT = { IV: 41, V: 43, iii: 40, vi: 45, I: 48 };
    const FORM = ['iii', 'vi', 'IV', 'V', 'iii', 'vi', 'IV', 'V', 'I'];

    FORM.forEach((c, bar) => {
      if (bar === 5) return; // the break: nothing but the words
      const soft = bar >= 6 ? 0.7 : 1;
      A._playChord(CH[c], ROOT[c], at(bar, -0.25), BAR);
      CH[c].forEach((n, k) => {
        A._pluck(n, 0.2 * soft, at(bar, 0) + k * 0.012, { dur: 2.6 });
        A._pluck(n, 0.12 * soft, at(bar, 2.5) + k * 0.012, { dur: 2 });
      });
      if ((bar >= 2 && bar <= 4) || bar >= 6) {
        bassNote(ROOT[c], at(bar, 0), 1.6 * B, soft);
        bassNote(ROOT[c], at(bar, 2.5), 1.3 * B, soft * 0.85);
      }
    });

    // the riser into the drop
    {
      const src = ctx.createBufferSource(); src.buffer = A._noise; src.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.Q.value = 1.2;
      hp.frequency.setValueAtTime(400, T(DROP - 2.2));
      hp.frequency.exponentialRampToValueAtTime(6000, T(DROP));
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, T(DROP - 2.2));
      g.gain.linearRampToValueAtTime(0.14, T(DROP - 0.02));
      g.gain.linearRampToValueAtTime(0, T(DROP));
      src.connect(hp); hp.connect(g); g.connect(A.verbIn); g.connect(A.dry);
      src.start(T(DROP - 2.2)); src.stop(T(DROP + 0.1));
    }
    // the drop: a crash, washed out
    noise(T(DROP), 2.2, 'highpass', 3200, 0.5, 0.2, drums, 2.0);

    // drums, only while everyone has someone (bars 2–4)
    for (let bar = 2; bar <= 4; bar++) {
      [0, 1.5, 2.75].forEach(b => kick(at(bar, b), 1));
      [1, 3].forEach(b => snare(at(bar, b), 1));
      for (let k = 0; k < 8; k++) hat(at(bar, k * 0.5 + (k % 2 ? 0.07 : 0)), k % 2 ? 0.6 : 1);
    }
    // a fill, then nothing
    snare(at(4, 3.5), 0.55);
    snare(at(4, 3.75), 0.75);

    // the hook. it sings the words.
    const sing = (bar, beat, n, v, dur, dest) => A._pluck(n, v == null ? 0.46 : v, at(bar, beat), { dur: dur || 3.4, dest: dest || lead });
    // bar 1, through the wall: a hint of what's coming
    [[2, 76], [2.5, 74], [3, 69]].forEach(([b, n]) => sing(1, b, n, 0.42, 3, A.music));
    // anybody can find love.
    [[0, 76], [0.5, 74], [1, 72], [1.5, 74], [2, 76], [3, 79]].forEach(([b, n]) => sing(2, b, n));
    [[0, 74], [0.5, 72], [1, 71], [1.5, 72], [2, 74], [3, 67]].forEach(([b, n]) => sing(3, b, n));
    [[0, 71], [0.75, 67], [1.5, 76], [2.5, 74], [3.25, 71]].forEach(([b, n]) => sing(4, b, n));
    // except you. alone.
    sing(5, 0.5, 76, 0.56, 4);
    sing(5, 1.25, 74, 0.52, 4);
    sing(5, 2.5, 69, 0.56, 7);
    sing(5, 2.5, 45, 0.42, 7);
    // after
    [[0, 72], [1.5, 76], [3, 74]].forEach(([b, n]) => sing(6, b, n, 0.36));
    [[0, 74], [1.5, 71], [3, 67]].forEach(([b, n]) => sing(7, b, n, 0.36));
    // and someone waves back
    [[0, 76], [0.5, 79], [1.5, 84]].forEach(([b, n]) => sing(8, b, n, 0.4, 6));

    A.master.gain.setValueAtTime(0.85, T(DURATION - 1.4));
    A.master.gain.linearRampToValueAtTime(0, T(DURATION));
  };

  /* ============================================================== */
  /*  the picture                                                    */
  /* ============================================================== */
  const buf = document.createElement('canvas');
  buf.width = W; buf.height = H;
  const bg = buf.getContext('2d');

  function litAll(extra) {
    const out = {};
    for (const w of D.windows) {
      out[w.id] = { lit: !!(w.lines || w.pose === 'cat' || w.pose === 'lamp'), stage: 3 };
      if (w.pose === 'sit') Object.assign(out[w.id], { gap: 0.25, tilt: 0.8 });
      if (w.pose === 'pair') Object.assign(out[w.id], { gap: 0.37, tilt: 0.45 });
    }
    return Object.assign(out, extra || {});
  }
  function center(id) { const r = L.rects[id]; return [r.x + r.w / 2, r.y + r.h / 2]; }

  // paint the building into ctx g with a camera: zoom around (cx, cy), placed at (px, py) on screen
  function camera(g, windows, t, zoom, cx, cy, px, py, extra) {
    g.save();
    g.translate(px, py);
    g.scale(zoom, zoom);
    g.translate(-cx, -cy);
    V.loud = 0;
    V.paintBuilding(g, W, H, Object.assign({ windows, t, labels: false, loud: 0, reflection: 0 }, extra || {}));
    g.restore();
  }
  const handheld = (t, k) => [k * (Math.sin(t * 1.7) * 4 + Math.sin(t * 4.3 + 1) * 2), k * (Math.sin(t * 1.3 + 2) * 3 + Math.sin(t * 3.7) * 1.5)];

  function introShot(g, t) {
    // focus pull through the rain, then rush toward the first window
    const rush = Math.pow(seg(t, DROP - 1.9, DROP), 2.2);
    const [tx, ty] = center(MONTAGE[0]);
    const z0 = 1.0 + 0.08 * (t / DROP);
    const zoom = lerp(z0, MONTAGE_ZOOM, rush);
    const k = 1 - (1 - rush) * z0 / zoom;
    const cx = lerp(W / 2, tx, k), cy = lerp(H * 0.55, ty, k);
    const [sx, sy] = handheld(t, 1);
    bg.setTransform(1, 0, 0, 1, 0, 0);
    bg.fillStyle = '#05060a';
    bg.fillRect(0, 0, W, H);
    camera(bg, litAll(), t, zoom, cx, cy, W / 2 + sx, lerp(H * 0.55, H * 0.44, rush) + sy);
    const blur = 9 * (1 - seg(t, 0.2, 2.8)) + 6 * Math.pow(rush, 3);
    g.save();
    if (blur > 0.3) g.filter = `blur(${blur.toFixed(1)}px)`;
    g.drawImage(buf, 0, 0);
    g.restore();
    rain(g, t, 0.75, 0);
  }

  function montageShot(g, t) {
    const i = Math.min(MONTAGE.length - 1, Math.floor((t - DROP) / B));
    const k = t - DROP - i * B;
    const id = MONTAGE[i];
    const [cx, cy] = center(id);
    const zoom = MONTAGE_ZOOM * (1 + 0.09 * (1 - seg(k, 0, 0.22))) * (1 + 0.035 * k / B);
    const [sx, sy] = handheld(t + i * 3, 1.6);
    camera(g, litAll(), t, zoom, cx, cy, W / 2 + sx, H * 0.44 + sy);
    // light leaks, a different burn on every cut
    g.save();
    g.globalCompositeOperation = 'screen';
    for (let n = 0; n < 2; n++) {
      const side = hash(i, n) < 0.5 ? -0.1 : 1.1;
      const lx = side * W + Math.sin(t * 0.8 + n) * 60, ly = hash(i, n + 7) * H;
      const r = W * (0.55 + hash(i, n + 3) * 0.4);
      const lg = g.createRadialGradient(lx, ly, 0, lx, ly, r);
      const warm = n ? '255,96,120' : '255,150,70';
      lg.addColorStop(0, `rgba(${warm},${0.26 + 0.1 * hash(i, 9)})`);
      lg.addColorStop(1, `rgba(${warm},0)`);
      g.fillStyle = lg;
      g.fillRect(0, 0, W, H);
    }
    g.restore();
  }

  function silhouette(g, x, base, h, color) {
    const head = h * 0.13, neck = base - h + head * 2.1, sw = h * 0.5;
    g.fillStyle = color;
    g.beginPath(); g.ellipse(x, base - h + head, head * 0.86, head, 0, 0, TAU); g.fill();
    g.beginPath();
    g.moveTo(x - sw / 2, base);
    g.bezierCurveTo(x - sw / 2, neck + h * 0.12, x - sw * 0.38, neck, x - head * 0.55, neck);
    g.lineTo(x + head * 0.55, neck);
    g.bezierCurveTo(x + sw * 0.38, neck, x + sw / 2, neck + h * 0.12, x + sw / 2, base);
    g.closePath(); g.fill();
  }

  function breakShot(g, t) {
    // everyone else, out of focus behind the glass. and you, in it.
    const k = t - BREAK;
    bg.setTransform(1, 0, 0, 1, 0, 0);
    bg.fillStyle = '#05060a';
    bg.fillRect(0, 0, W, H);
    camera(bg, litAll(), t, 1.25 + 0.03 * k, W / 2, H * 0.5, W / 2, H * 0.5);
    g.save();
    g.filter = 'blur(26px)';
    g.globalAlpha = 0.7;
    g.drawImage(buf, 0, 0);
    g.restore();
    g.fillStyle = 'rgba(6,8,16,0.35)';
    g.fillRect(0, 0, W, H);
    g.save();
    g.filter = 'blur(3px)';
    silhouette(g, W * 0.5 + Math.sin(t * 0.6) * 4, H * 1.04, H * 0.62, `rgba(176,188,220,${0.2 * seg(k, 0.05, 1.4)})`);
    g.restore();
    rain(g, t, 0.35, 0);
  }

  function endShot(g, t) {
    // they go to sleep, two by two. then one light comes on.
    const wins = litAll();
    LIGHTS_OUT.forEach((id, n) => { if (t >= BACK + 0.35 + n * 0.19) wins[id].lit = false; });
    const six = t >= SIX && !(t < SIX + 0.08 || (t >= SIX + 0.16 && t < SIX + 0.22) || (t >= SIX + 0.3 && t < SIX + 0.34));
    wins['6d'] = { lit: six, stage: 1, wave: t > HOME + 0.25 && t < HOME + 2.3 ? Math.abs(Math.sin((t - HOME - 0.25) * 3.1)) : 0 };
    const [tx, ty] = center('6d');
    const pull = seg(t, BACK, SIX);
    const push = seg(t, SIX + 0.4, DURATION);
    const z0 = 1.14 - 0.12 * pull;
    const zoom = lerp(z0, 3.6, push);
    const k = 1 - (1 - push) * z0 / zoom;
    const cx = lerp(W / 2, tx, k), cy = lerp(H * 0.55, ty, k);
    const [sx, sy] = handheld(t, 0.8);
    camera(g, wins, t, zoom, cx, cy, W / 2 + sx, lerp(H * 0.55, H * 0.42, push) + sy);
    rain(g, t, 0.6, 0);
  }

  // drops on your own glass
  const DROPS = Array.from({ length: 52 }, (_, i) => ({
    x: hash(i, 21) * W, y: hash(i, 22) * H, r: 5 + Math.pow(hash(i, 23), 2) * 20,
    v: hash(i, 24) < 0.4 ? 18 + hash(i, 25) * 70 : 0,
  }));
  function droplets(g, t, a) {
    g.save();
    for (const d of DROPS) {
      const y = d.v ? (d.y + d.v * t) % (H + 60) - 30 : d.y;
      const x = d.x + (d.v ? Math.sin(y * 0.02 + d.x) * 3 : 0);
      if (d.v) {
        g.strokeStyle = `rgba(200,210,235,${0.06 * a})`;
        g.lineWidth = d.r * 0.55;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, y - Math.min(160, d.v * 2.2)); g.lineTo(x, y); g.stroke();
      }
      const gr = g.createRadialGradient(x - d.r * 0.3, y - d.r * 0.35, d.r * 0.1, x, y, d.r);
      gr.addColorStop(0, `rgba(255,255,255,${0.14 * a})`);
      gr.addColorStop(0.55, `rgba(170,180,210,${0.04 * a})`);
      gr.addColorStop(0.86, `rgba(8,10,18,${0.2 * a})`);
      gr.addColorStop(1, `rgba(225,230,245,${0.24 * a})`);
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, d.r, 0, TAU); g.fill();
      g.fillStyle = `rgba(255,255,255,${0.32 * a})`;
      g.beginPath(); g.arc(x - d.r * 0.36, y - d.r * 0.4, d.r * 0.17, 0, TAU); g.fill();
    }
    g.restore();
  }

  function grade(g, rgba) {
    g.save();
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = rgba;
    g.fillRect(0, 0, W, H);
    g.restore();
  }

  Edit.draw = function (g, t) {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.filter = 'none';
    g.fillStyle = '#05060a';
    g.fillRect(0, 0, W, H);

    if (t < DROP) { introShot(g, t); droplets(g, t, 0.85); grade(g, 'rgba(60,80,150,0.45)'); }
    else if (t < BREAK) { montageShot(g, t); droplets(g, t, 0.4); grade(g, 'rgba(255,165,90,0.28)'); }
    else if (t < BACK) { breakShot(g, t); droplets(g, t, 1); grade(g, 'rgba(40,60,130,0.5)'); }
    else { endShot(g, t); droplets(g, t, 0.8); grade(g, 'rgba(60,80,150,0.4)'); }

    // words
    const out12 = 1 - seg(t, BACK - 0.55, BACK - 0.1);
    if (t < BREAK) {
      const a = seg(t, 0.2, 0.65);
      words(g, 'anybody can find love.', W / 2, H * 0.79, { font: `italic 84px ${SERIF}`, alpha: a, blur: (1 - a) * 10, shadow: 34 });
    } else if (t < BACK) {
      words(g, 'anybody can find love.', W / 2, H * 0.42, { font: `italic 84px ${SERIF}`, alpha: out12, shadow: 40 });
      const a = seg(t, BREAK + 0.5 * B, BREAK + 0.5 * B + 0.4) * out12;
      words(g, 'except you.', W / 2, H * 0.42 + 150, { font: `italic 150px ${SERIF}`, alpha: a, blur: (1 - seg(t, BREAK + 0.5 * B, BREAK + 0.5 * B + 0.4)) * 12, shadow: 40 });
    }
    if (t >= HOME + 0.7) {
      const a = seg(t, HOME + 0.7, HOME + 1.3);
      words(g, 'someone else is awake too.', W / 2, H * 0.79, { font: `italic 66px ${SERIF}`, alpha: a, blur: (1 - a) * 8, shadow: 34 });
    }

    // flashes: the drop, and every snare while the drums play
    let flash = t >= DROP ? 0.75 * (1 - seg(t, DROP, DROP + 0.18)) : 0;
    if (t >= DROP && t < BREAK) {
      const beat = (t - DROP) / B, n = Math.floor(beat), k = (beat - n) * B;
      if (n % 2 === 1) flash = Math.max(flash, 0.13 * (1 - seg(k, 0, 0.12)));
      flash = Math.max(flash, 0.06 * (1 - seg(k, 0, 0.06)));
    }
    if (flash > 0.002) { g.fillStyle = `rgba(255,236,214,${flash})`; g.fillRect(0, 0, W, H); }

    const vg = g.createRadialGradient(W / 2, H * 0.45, W * 0.38, W / 2, H * 0.45, H * 0.76);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.68)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    grain(g, 0.085);

    const black = Math.max(1 - seg(t, 0, 0.35), seg(t, DURATION - 1.1, DURATION));
    if (black > 0.002) { g.fillStyle = `rgba(0,0,0,${black})`; g.fillRect(0, 0, W, H); }
    g.restore();
  };

  root.Edit = Edit;
})(window);
