/* except you. — the clip. seventeen vertical seconds for people who are scrolling at 3 am.
   Clip.draw(g, t) paints one frame for clip time t (seconds), the same way every time,
   so the renderer can step through it frame by frame and a phone can play it live. */
(function (root) {
  'use strict';

  const D = root.DATA, V = root.Visuals;
  const W = 1080, H = 1920, FPS = 30, DURATION = 17;
  const Clip = { W, H, FPS, DURATION };

  const hash = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  const smooth = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const seg = (t, a, b) => smooth((t - a) / (b - a));
  const NAMES = ['', ' thousand', ' million', ' billion', ' trillion', ' quadrillion', ' quintillion'];
  const fmt = n => {
    if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
    const e = Math.floor(Math.log10(n) / 3);
    return (n / Math.pow(10, e * 3)).toFixed(2) + NAMES[Math.min(e, NAMES.length - 1)];
  };

  const SERIF = '"Instrument Serif", Georgia, serif';
  const BODY = '"Spectral", Georgia, serif';
  const MONO = '"DM Mono", ui-monospace, monospace';

  /* -------------------------------------------------------------- */
  let grainTile = null;
  function grain(g, alpha) {
    if (!grainTile) {
      grainTile = document.createElement('canvas');
      grainTile.width = grainTile.height = 256;
      const gg = grainTile.getContext('2d');
      const img = gg.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      gg.putImageData(img, 0, 0);
    }
    g.save();
    g.globalAlpha = alpha;
    g.globalCompositeOperation = 'overlay';
    const ox = Math.floor(Math.random() * 256), oy = Math.floor(Math.random() * 256);
    for (let x = -ox; x < W; x += 256) for (let y = -oy; y < H; y += 256) g.drawImage(grainTile, x, y);
    g.restore();
  }

  function rain(g, t, level, red) {
    if (level <= 0) return;
    g.save();
    g.lineCap = 'round';
    const slant = 0.14 + red * 0.08;
    const r = Math.round(175 + 35 * red), gr = Math.round(188 - 70 * red), b = Math.round(220 - 90 * red);
    for (let i = 0; i < 260; i++) {
      const sp = 1300 + hash(i, 1) * 1100;
      const len = 26 + hash(i, 2) * 50;
      const span = H + 200;
      const y = ((hash(i, 3) * span + sp * t) % span) - 100;
      const x = hash(i, 4) * (W + 300) - 150 + y * slant;
      g.strokeStyle = `rgba(${r},${gr},${b},${(0.05 + hash(i, 5) * 0.13) * level})`;
      g.lineWidth = hash(i, 6) < 0.15 ? 2.4 : 1.4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - len * slant, y - len);
      g.stroke();
    }
    g.restore();
  }

  // a line of words. blur-in like the game's cutscenes, with an optional red/cyan split.
  function words(g, str, x, y, o) {
    const a = o.alpha == null ? 1 : o.alpha;
    if (a <= 0.003) return;
    g.save();
    g.font = o.font;
    g.textAlign = o.align || 'center';
    g.textBaseline = 'middle';
    if (o.blur) g.filter = `blur(${o.blur.toFixed(1)}px)`;
    g.shadowColor = 'rgba(0,0,0,0.95)';
    g.shadowBlur = o.shadow == null ? 40 : o.shadow;
    if (o.split) {
      g.globalAlpha = a * 0.6;
      g.fillStyle = 'rgb(214,90,82)';
      g.fillText(str, x + o.split, y);
      g.fillStyle = 'rgb(120,190,255)';
      g.fillText(str, x - o.split, y);
    }
    g.globalAlpha = a;
    g.fillStyle = o.color || '#ddd6c8';
    g.fillText(str, x, y);
    g.restore();
  }

  function windowsAt(t) {
    const out = {};
    for (const w of D.windows) {
      const idx = D.lightOrder.indexOf(w.id);
      const lightable = !!(w.lines || w.pose === 'cat' || w.pose === 'lamp');
      let lit = false, stage = 1, flick;
      if (lightable && idx > -1) {
        const on = -0.7 + idx * 0.21;
        lit = t >= on;
        stage = t < on + 0.9 ? 1 : t < on + 1.8 ? 2 : 3;
      }
      if (t >= 8.0 && w.lines) {
        if (t >= 8.25 + hash(idx + 3, 9) * 2.1) lit = false;
        else if (hash(Math.floor(t * 14), idx + 1) < 0.18) flick = 0.35;
      }
      out[w.id] = { lit, stage, flick };
    }
    return out;
  }

  const FLOATERS = [
    ['too much', 0.18, 0.30, 8.05, 76], ['haha yeah', 0.72, 0.62, 8.35, 64], ['not enough', 0.28, 0.74, 8.6, 82],
    ['they could tell', 0.66, 0.36, 8.85, 70], ['why are you like this', 0.5, 0.86, 9.1, 66], ['seen 3:02 am', 0.25, 0.52, 9.3, 58],
    ['unlovable', 0.74, 0.5, 9.5, 92], ['say something', 0.35, 0.2, 9.7, 62], ['no. not that', 0.68, 0.78, 9.85, 60],
    ['you ruin it', 0.3, 0.64, 10.0, 84], ['stop', 0.6, 0.27, 10.1, 110], ['always like this', 0.45, 0.44, 10.2, 70],
  ];

  /* -------------------------------------------------------------- */
  Clip.draw = function (g, t) {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = t >= 10.6 && t < 13 ? '#000' : '#07080d';
    g.fillRect(0, 0, W, H);

    const loud = t >= 8 && t < 10.6 ? 0.55 + 0.45 * seg(t, 8, 10.4) : 0;

    /* the building: 0 – 10.6 */
    if (t < 10.6) {
      const fade = seg(t, 0, 0.45);
      const dim = t < 4 ? 1 : t < 8 ? 1 - 0.48 * seg(t, 4, 5.4) : 0.55 + (Math.random() < 0.12 ? -0.3 : 0);
      const zoom = 1.02 + 0.08 * Math.min(1, t / 10.6);
      g.save();
      g.globalAlpha = fade * dim;
      if (loud) g.translate((Math.random() - 0.5) * 14 * loud, (Math.random() - 0.5) * 8 * loud);
      g.translate(W / 2, H * 0.55);
      g.scale(zoom, zoom);
      g.translate(-W / 2, -H * 0.55);
      V.loud = loud;
      V.paintBuilding(g, W, H, {
        windows: windowsAt(t), t, labels: false, loud,
        reflection: 0.62 * seg(t, 4.5, 6.6) * (t >= 8 ? (Math.random() < 0.25 ? 0.2 : 0.75) : 1),
      });
      g.restore();
      rain(g, t, 1, loud);
    }

    /* a soft dark band where the words go */
    if (t < 8) {
      const band = g.createRadialGradient(W / 2, H * 0.43, 40, W / 2, H * 0.43, W * 0.85);
      band.addColorStop(0, `rgba(3,3,6,${0.78 * seg(t, 0.1, 0.9)})`);
      band.addColorStop(1, 'rgba(3,3,6,0)');
      g.fillStyle = band;
      g.fillRect(0, 0, W, H);
    }

    /* anybody can find love. / except you. */
    if (t < 8.05) {
      const out = 1 - seg(t, 7.75, 8.0);
      const a1 = seg(t, 0.12, 0.7) * out;
      words(g, 'anybody can find love.', W / 2, H * 0.4, { font: `italic 100px ${SERIF}`, alpha: a1, blur: (1 - seg(t, 0.12, 0.7)) * 12 });
      const a2 = seg(t, 4.0, 4.7) * out;
      words(g, 'except you.', W / 2, H * 0.4 + 170, { font: `italic 168px ${SERIF}`, alpha: a2, blur: (1 - seg(t, 4.0, 4.7)) * 16 });
    }

    /* it gets loud: 8.0 – 10.6 */
    if (t >= 8 && t < 10.6) {
      const k = seg(t, 8.0, 10.45);
      const n = Math.pow(10, 3 + 13.4 * k);
      const glitchNum = Math.random() < 0.08 * loud ? 'too many' : fmt(n);
      words(g, glitchNum, W / 2, H * 0.15, { font: `${n > 1e6 ? 118 : 150}px ${SERIF}`, split: 5 * loud, shadow: 30 });
      words(g, 'thoughts', W / 2, H * 0.15 + 100, { font: `400 34px ${MONO}`, color: '#8a8ea0', shadow: 0 });
      for (const [txt, fx, fy, t0, size] of FLOATERS) {
        if (t < t0) continue;
        const life = t - t0;
        const a = Math.min(1, life / 0.12) * (1 - seg(life, 0.9, 1.4));
        words(g, txt, fx * W + life * 30 * (fx < 0.5 ? 1 : -1), fy * H - life * 20, {
          font: `italic ${size}px ${SERIF}`, color: '#eaa59d', alpha: a, split: 3 + 4 * loud, shadow: 18,
        });
      }
      if (t >= 10.15) {
        g.save();
        g.globalAlpha = 0.45;
        g.fillStyle = Math.floor(t * 20) % 2 ? 'rgb(110,18,22)' : 'rgb(10,14,30)';
        g.fillRect(0, 0, W, H);
        g.restore();
        words(g, 'MAKE IT STOP', W / 2 + (Math.random() - 0.5) * 16, H * 0.5, { font: `140px ${SERIF}`, color: '#f6dcd8', split: 9, shadow: 0 });
      }
      // vignette tightening
      const v = g.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, H * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(40,0,4,${0.55 * k})`);
      g.fillStyle = v;
      g.fillRect(0, 0, W, H);
    }

    /* i'm still here. */
    if (t >= 11.2 && t < 13.1) {
      const a = seg(t, 11.3, 12.0) * (1 - seg(t, 12.6, 13.05));
      words(g, "i'm still here.", W / 2, H * 0.48, { font: `italic 300 78px ${BODY}`, color: '#9aa1c4', alpha: a, blur: (1 - seg(t, 11.3, 12.0)) * 10, shadow: 0 });
    }

    /* morning */
    if (t >= 12.6) {
      const d = seg(t, 12.6, 15.2);
      const sky = g.createLinearGradient(0, H, 0, 0);
      sky.addColorStop(0, `rgba(243,183,156,${0.24 * d})`);
      sky.addColorStop(0.45, `rgba(132,116,178,${0.12 * d})`);
      sky.addColorStop(0.85, 'rgba(7,8,13,0)');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      const a = seg(t, 13.0, 13.9);
      g.save();
      g.font = `italic 190px ${SERIF}`;
      g.textBaseline = 'middle';
      const word = 'except you', dot = '.';
      const ww = g.measureText(word).width, dw = g.measureText(dot).width;
      g.restore();
      const x0 = W / 2 - (ww + dw) / 2;
      words(g, word, x0, H * 0.44, { font: `italic 190px ${SERIF}`, align: 'left', alpha: a, blur: (1 - a) * 14, shadow: 0 });
      words(g, dot, x0 + ww, H * 0.44, { font: `italic 190px ${SERIF}`, align: 'left', color: '#f2c27b', alpha: a * (0.6 + 0.4 * Math.cos((t - 13) * 2.2)), shadow: 0 });
      words(g, 'an incremental game about 3 am', W / 2, H * 0.44 + 150, { font: `400 36px ${MONO}`, color: '#8a8ea0', alpha: seg(t, 13.6, 14.4), shadow: 0 });
      words(g, 'free · plays in your browser', W / 2, H * 0.44 + 214, { font: `400 30px ${MONO}`, color: '#5f6274', alpha: seg(t, 14.2, 15.0), shadow: 0 });
    }

    /* the edges of the room */
    const vg = g.createRadialGradient(W / 2, H * 0.48, W * 0.42, W / 2, H * 0.48, H * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    grain(g, 0.06 + loud * 0.07);

    /* fade out */
    if (t > 16.3) {
      g.fillStyle = `rgba(0,0,0,${seg(t, 16.3, 17)})`;
      g.fillRect(0, 0, W, H);
    }
    g.restore();
  };

  Clip.ready = async function () {
    await Promise.all([
      `italic 100px ${SERIF}`, `100px ${SERIF}`, `italic 300 60px ${BODY}`, `400 30px ${MONO}`,
    ].map(f => document.fonts.load(f).catch(() => null)));
    await document.fonts.ready;
  };

  root.Clip = Clip;
})(window);
