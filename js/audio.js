/* except you. — sound. everything is synthesized; nothing is loaded.
   rain, a slowed-down chord loop with too much reverb, your clicks as piano notes,
   and, later, the things that come with not sleeping: a heartbeat, a ringing, a warble. */
(function (root) {
  'use strict';

  const A = {
    ctx: null,
    muted: false,
    transpose: -2,          // everything a little lower, like the slowed edits
    loud: 0,
    act: 1,
    rainLevel: 1,
    birds: false,
    heart: 0,               // beats per minute, 0 = none
    progression: 'night',
    _chordIdx: 0,
    _nextChord: 0,
    _nextBeat: 0,
    _nextBird: 0,
    _nextWhisper: 0,
    _melody: 72,
    _voices: [],
    _wobbleTargets: [],
  };

  const PROG = {
    night: {
      // IV△7 – V7 – iii7 – vi7 in C. the "royal road". every sad edit has it somewhere.
      chords: [[53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62], [57, 60, 64, 67]],
      bass: [41, 43, 40, 45],
      len: 7.5,
    },
    loud: {
      chords: [[53, 56, 60, 64], [55, 58, 62, 65], [52, 55, 58, 62], [57, 60, 63, 67]],
      bass: [41, 42, 40, 45],
      len: 5.5,
    },
    dawn: {
      // I – V/vii – vi – IV, slowly. it resolves.
      chords: [[55, 60, 64, 71], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 64]],
      bass: [48, 47, 45, 41],
      len: 9,
    },
  };
  const SCALE = [0, 2, 4, 7, 9]; // pentatonic, it is very hard to play a wrong note

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function noiseBuffer(ctx, seconds, kind) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    return buf;
  }

  function impulse(ctx, seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (t < 0.01 ? t / 0.01 : 1);
      }
    }
    return buf;
  }

  function shaperCurve(amount) {
    const n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
    }
    return curve;
  }

  A.init = function () {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return;
    }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    let ctx;
    try { ctx = new AC(); } catch (e) { return; }
    A.build(ctx, true);
  };

  // the whole signal chain, on a live context or an offline one
  A.build = function (ctx, live) {
    A.ctx = ctx;
    const now = ctx.currentTime;

    A.master = ctx.createGain();
    A.master.gain.value = 0;
    if (live) A.master.gain.setTargetAtTime(A.muted ? 0 : 0.85, now, 1.5);
    else A.master.gain.setValueAtTime(0.85, now);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
    comp.attack.value = 0.01; comp.release.value = 0.4;
    A.master.connect(comp);
    comp.connect(ctx.destination);

    A.verb = ctx.createConvolver();
    A.verb.buffer = impulse(ctx, 5.5, 2.6);
    A.verbIn = ctx.createGain();
    A.verbIn.gain.value = 0.9;
    A.verbIn.connect(A.verb);
    A.verb.connect(A.master);
    A.dry = ctx.createGain();
    A.dry.gain.value = 1;
    A.dry.connect(A.master);

    // music bus: lowpassed, mostly wet
    A.music = ctx.createGain();
    A.music.gain.value = 0.9;
    A.musicLP = ctx.createBiquadFilter();
    A.musicLP.type = 'lowpass';
    A.musicLP.frequency.value = 2600;
    A.music.connect(A.musicLP);
    const musicDry = ctx.createGain(); musicDry.gain.value = 0.45;
    const musicWet = ctx.createGain(); musicWet.gain.value = 0.9;
    A.musicLP.connect(musicDry); musicDry.connect(A.dry);
    A.musicLP.connect(musicWet); musicWet.connect(A.verbIn);

    // a parallel grit path that only opens when it gets loud
    A.grit = ctx.createWaveShaper();
    A.grit.curve = shaperCurve(30);
    A.gritGain = ctx.createGain();
    A.gritGain.gain.value = 0;
    A.music.connect(A.grit); A.grit.connect(A.gritGain); A.gritGain.connect(A.dry);

    // pad bus
    A.pad = ctx.createGain();
    A.pad.gain.value = 0.0;
    A.pad.gain.setTargetAtTime(0.32, now + 1, 4);
    A.padLP = ctx.createBiquadFilter();
    A.padLP.type = 'lowpass'; A.padLP.frequency.value = 900; A.padLP.Q.value = 0.4;
    A.pad.connect(A.padLP); A.padLP.connect(A.music);

    // tape warble. every pad oscillator listens to this.
    A.wobble = ctx.createOscillator();
    A.wobble.frequency.value = 0.31;
    A.wobbleDepth = ctx.createGain();
    A.wobbleDepth.gain.value = 3;
    A.wobble.connect(A.wobbleDepth);
    A.wobble.start();

    // rain
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = noiseBuffer(ctx, 5, 'pink');
    rainSrc.loop = true;
    const rainHP = ctx.createBiquadFilter(); rainHP.type = 'highpass'; rainHP.frequency.value = 500;
    const rainLP = ctx.createBiquadFilter(); rainLP.type = 'lowpass'; rainLP.frequency.value = 4200;
    A.rain = ctx.createGain(); A.rain.gain.value = 0;
    A.rain.gain.setTargetAtTime(0.13, now, 2);
    rainSrc.connect(rainHP); rainHP.connect(rainLP); rainLP.connect(A.rain);
    A.rain.connect(A.dry);
    const rainVerb = ctx.createGain(); rainVerb.gain.value = 0.2;
    A.rain.connect(rainVerb); rainVerb.connect(A.verbIn);
    rainSrc.start();

    // the room: a low city hum through the wall
    const roomSrc = ctx.createBufferSource();
    roomSrc.buffer = noiseBuffer(ctx, 6, 'brown');
    roomSrc.loop = true;
    const roomLP = ctx.createBiquadFilter(); roomLP.type = 'lowpass'; roomLP.frequency.value = 160;
    A.room = ctx.createGain(); A.room.gain.value = 0.11;
    roomSrc.connect(roomLP); roomLP.connect(A.room); A.room.connect(A.dry);
    roomSrc.start();

    // ringing in the ears
    A.tin = ctx.createGain(); A.tin.gain.value = 0;
    [6120, 6127].forEach(f => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      o.connect(A.tin); o.start();
    });
    A.tin.connect(A.dry);

    // a held dissonance under everything, for the loud part
    A.dis = ctx.createGain(); A.dis.gain.value = 0;
    const disLP = ctx.createBiquadFilter(); disLP.type = 'lowpass'; disLP.frequency.value = 700;
    [mtof(46), mtof(47), mtof(58.3)].forEach(f => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      A.wobbleDepth.connect(o.detune);
      o.connect(disLP); o.start();
    });
    disLP.connect(A.dis); A.dis.connect(A.music);

    A._noise = noiseBuffer(ctx, 3, 'pink');
    if (live) {
      A._nextChord = now + 0.5;
      A._timer = setInterval(A._schedule, 90);
    }
  };

  /* -------------------------------------------------------------- */
  /*  the clip: seventeen seconds, scored note by note               */
  /*  clip time 0 is ctx time t0 + LEAD, so chords can swell in early */
  /* -------------------------------------------------------------- */
  A.CLIP_LEAD = 1.5;
  A.clipScore = function (t0) {
    const ctx = A.ctx;
    const T = x => t0 + A.CLIP_LEAD + x;
    const P = PROG.night, L = PROG.loud, Dn = PROG.dawn;
    A.transpose = -2;
    A.heartVol = 1;
    A.rain.gain.cancelScheduledValues(t0);
    A.rain.gain.setValueAtTime(0.12, t0);
    A.pad.gain.cancelScheduledValues(t0);
    A.pad.gain.setValueAtTime(0.42, t0);
    A.padLP.frequency.setValueAtTime(1300, t0);

    // anybody can find love. (IV)
    A._playChord(P.chords[0], P.bass[0], T(-1.5), 5.4);
    [[76, 0.4], [74, 0.85], [72, 1.3], [74, 1.75], [76, 2.2], [79, 2.95]].forEach(([n, dt]) => A._pluck(n, 0.42, T(dt), { dur: 3.6 }));
    // except you. (vi) — it falls, and doesn't come back up
    A._playChord(P.chords[3], P.bass[3], T(3.95), 4.0);
    [[76, 4.0], [74, 4.65], [69, 5.6]].forEach(([n, dt]) => A._pluck(n, 0.5, T(dt), { dur: 5 }));
    A._pluck(45, 0.5, T(5.6), { dur: 6 });

    // it gets loud
    A._playChord(L.chords[0], L.bass[0], T(8.0), 2.6);
    A.dis.gain.setValueAtTime(0, T(8.0));
    A.dis.gain.linearRampToValueAtTime(0.075, T(10.5));
    A.wobbleDepth.gain.setValueAtTime(3, T(8.0));
    A.wobbleDepth.gain.linearRampToValueAtTime(48, T(10.5));
    A.wobble.frequency.setValueAtTime(0.31, T(8.0));
    A.wobble.frequency.linearRampToValueAtTime(2.6, T(10.5));
    A.tin.gain.setValueAtTime(0, T(8.0));
    A.tin.gain.linearRampToValueAtTime(0.0035, T(10.5));
    A.gritGain.gain.setValueAtTime(0, T(8.0));
    A.gritGain.gain.linearRampToValueAtTime(0.05, T(10.5));
    A.rain.gain.setValueAtTime(0.12, T(8.0));
    A.rain.gain.linearRampToValueAtTime(0.22, T(10.5));
    [8.0, 8.55, 9.05, 9.5, 9.88, 10.2, 10.45].forEach(b => A._beat(T(b)));
    A.loud = 0.9;
    [8.3, 8.8, 9.3, 9.7, 10.0, 10.3].forEach(w => A._whisperNoise(T(w)));
    [8.2, 8.7, 9.2, 9.6, 9.95, 10.25].forEach((dt, i) => A._pluck(72 + (i % 3), 0.35, T(dt), { dur: 1.2, detune: (i % 2 ? 1 : -1) * 60 }));

    // MAKE IT STOP. then nothing.
    const cut = T(10.6);
    A.master.gain.setValueAtTime(0.85, cut - 0.02);
    A.master.gain.linearRampToValueAtTime(0, cut + 0.02);
    [A.dis.gain, A.tin.gain, A.gritGain.gain, A.pad.gain].forEach(p => p.setValueAtTime(0, cut + 0.05));
    A.rain.gain.setValueAtTime(0.025, cut + 0.05);
    A.wobbleDepth.gain.setValueAtTime(3, cut + 0.05);
    A.wobble.frequency.setValueAtTime(0.31, cut + 0.05);
    A.master.gain.setValueAtTime(0, T(11.1));
    A.master.gain.linearRampToValueAtTime(0.85, T(11.6));

    // i'm still here. (the sound of keeping something)
    [79, 84, 88].forEach((n, i) => A._pluck(n, 0.2, T(11.35 + i * 0.14), { dur: 3.5 }));
    // morning
    A.pad.gain.setValueAtTime(0, T(11.8));
    A.pad.gain.linearRampToValueAtTime(0.36, T(13.2));
    A._playChord(Dn.chords[0], Dn.bass[0], T(11.9), 5.5);
    [48, 55, 60, 64, 67, 71, 74].forEach((n, i) => A._pluck(n, 0.3, T(13.0 + i * 0.09), { dur: 6 }));
    A.birdVol = 0.8;
    [13.6, 14.7, 15.6].forEach(b => A._birdSong(T(b)));
    A.master.gain.setValueAtTime(0.85, T(16.2));
    A.master.gain.linearRampToValueAtTime(0, T(17.0));
  };

  // render the clip's audio without a speaker. returns a 16-bit stereo wav as base64.
  A.renderClipWav = async function (seconds) {
    const rate = 44100;
    const OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    const ctx = new OAC(2, Math.ceil(rate * (seconds + A.CLIP_LEAD)), rate);
    A.build(ctx, false);
    A.clipScore(0);
    const buf = await ctx.startRendering();
    const n = buf.length, ch = [buf.getChannelData(0), buf.getChannelData(1)];
    const bytes = new DataView(new ArrayBuffer(44 + n * 4));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) bytes.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); bytes.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
    bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 2, true);
    bytes.setUint32(24, rate, true); bytes.setUint32(28, rate * 4, true); bytes.setUint16(32, 4, true);
    bytes.setUint16(34, 16, true); str(36, 'data'); bytes.setUint32(40, n * 4, true);
    for (let i = 0, o = 44; i < n; i++) {
      for (let c = 0; c < 2; c++, o += 2) {
        const v = Math.max(-1, Math.min(1, ch[c][i]));
        bytes.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      }
    }
    let bin = '';
    const u8 = new Uint8Array(bytes.buffer);
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(bin);
  };

  A.resume = function () {
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  };

  A.setMuted = function (m) {
    A.muted = m;
    if (!A.ctx) return;
    A.master.gain.setTargetAtTime(m ? 0 : 0.85, A.ctx.currentTime, 0.3);
  };

  /* -------------------------------------------------------------- */
  A._schedule = function () {
    const ctx = A.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const prog = PROG[A.progression];

    if (now >= A._nextChord - 0.05) {
      A._chordIdx = (A._chordIdx + 1) % prog.chords.length;
      A._playChord(prog.chords[A._chordIdx], prog.bass[A._chordIdx], A._nextChord, prog.len);
      A._nextChord += prog.len * (1 - 0.15 * A.loud);
      if (A._nextChord < now) A._nextChord = now + 0.2;
    }

    if (A.heart > 0 && now >= A._nextBeat) {
      A._beat(A._nextBeat < now ? now + 0.02 : A._nextBeat);
      A._nextBeat = Math.max(now, A._nextBeat) + 60 / A.heart;
    }

    if (A.birds && now >= A._nextBird) {
      A._birdSong(now + 0.05);
      A._nextBird = now + 2.5 + Math.random() * 6;
    }

    if (A.loud > 0.45 && A.act === 3 && now >= A._nextWhisper) {
      A._whisperNoise(now);
      A._nextWhisper = now + 0.6 + Math.random() * (5 - A.loud * 4);
    }

    // prune finished voices
    A._voices = A._voices.filter(v => v.end > now);
  };

  A._osc = function (type, freq, t, end, dest, detuneTrack) {
    const o = A.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    if (detuneTrack) A.wobbleDepth.connect(o.detune);
    o.connect(dest);
    o.start(t);
    o.stop(end);
    return o;
  };

  A._playChord = function (notes, bass, t, len) {
    const ctx = A.ctx;
    const g = ctx.createGain();
    const end = t + len + 4.5;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.13, t + 2.4);
    g.gain.setValueAtTime(0.13, t + len);
    g.gain.exponentialRampToValueAtTime(0.0008, end);
    g.connect(A.pad);
    for (const n of notes) {
      const f = mtof(n + A.transpose);
      A._osc('triangle', f, t, end, g, true);
      A._osc('sine', f * 1.003, t, end, g, true);
    }
    // the bass: one long sine, felt more than heard
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0, t);
    bg.gain.linearRampToValueAtTime(0.22, t + 1.2);
    bg.gain.setValueAtTime(0.22, t + len);
    bg.gain.exponentialRampToValueAtTime(0.0008, end);
    bg.connect(A.pad);
    A._osc('sine', mtof(bass + A.transpose), t, end, bg, true);
    A._voices.push({ end });
  };

  A._pluck = function (midi, vel, t, opts) {
    const ctx = A.ctx;
    if (!ctx) return;
    t = t || ctx.currentTime;
    vel = vel == null ? 0.5 : vel;
    const dur = (opts && opts.dur) || 2.8;
    const f = mtof(midi + A.transpose);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16 * vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.05 * vel, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3800, t);
    lp.frequency.exponentialRampToValueAtTime(900, t + dur * 0.6);
    g.connect(lp);
    lp.connect((opts && opts.dest) || A.music);
    const detune = (opts && opts.detune) || 0;
    const o1 = A._osc('triangle', f, t, t + dur + 0.1, g, false);
    const o2 = A._osc('sine', f * 2.001, t, t + dur + 0.1, g, false);
    if (detune) { o1.detune.value = detune; o2.detune.value = detune; }
    // a hammer: a tiny noise tick
    const tick = ctx.createBufferSource();
    tick.buffer = A._noise;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.05 * vel, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    const tbp = ctx.createBiquadFilter(); tbp.type = 'bandpass'; tbp.frequency.value = 2400;
    tick.connect(tbp); tbp.connect(tg); tg.connect(lp);
    tick.start(t, Math.random() * 2, 0.05);
  };

  A._chordTones = function () {
    const prog = PROG[A.progression];
    return prog.chords[A._chordIdx];
  };

  // your clicks, as a melody that wanders but never lands anywhere wrong
  A.click = function () {
    if (!A.ctx) return;
    const tones = A._chordTones().map(n => n % 12);
    const pool = [];
    for (let oct = 5; oct <= 6; oct++) {
      for (const pc of SCALE) pool.push(oct * 12 + pc);
      for (const pc of tones) pool.push(oct * 12 + pc);
    }
    const near = pool.filter(n => Math.abs(n - A._melody) <= 5 && n !== A._melody);
    let next = near.length ? near[Math.floor(Math.random() * near.length)] : 72;
    if (next > 86) next -= 12;
    if (next < 62) next += 12;
    A._melody = next;
    const detune = A.act === 3 ? (Math.random() - 0.5) * 80 * A.loud : 0;
    A._pluck(next, 0.35 + Math.random() * 0.15, null, { detune });
  };

  A.buy = function () {
    if (!A.ctx) return;
    const root = A._chordTones()[0];
    const t = A.ctx.currentTime;
    A._pluck(root, 0.45, t);
    A._pluck(root + 7, 0.3, t + 0.09);
  };

  A.keep = function () {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    [79, 84, 88].forEach((n, i) => A._pluck(n, 0.22, t + i * 0.12, { dur: 3.5 }));
  };

  A.ding = function (kind) {
    const ctx = A.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const notes = kind === 'loud' ? [1318, 1245] : [1318, 1760];
    notes.forEach((f, i) => {
      const g = ctx.createGain();
      const s = t + i * 0.13;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.07, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0005, s + 0.9);
      g.connect(A.dry);
      const o = A._osc('sine', f, s, s + 1, g, false);
      if (kind === 'loud') o.detune.value = -40 + Math.random() * 30;
    });
  };

  A._beat = function (t) {
    const ctx = A.ctx;
    const vol = 0.55 * Math.min(1, A.heartVol == null ? 1 : A.heartVol);
    [[0, 1], [0.2, 0.7]].forEach(([dt, v]) => {
      const s = t + dt;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(62, s);
      o.frequency.exponentialRampToValueAtTime(38, s + 0.14);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(vol * v, s + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0005, s + 0.22);
      o.connect(g); g.connect(A.dry);
      o.start(s); o.stop(s + 0.25);
    });
  };

  A._whisperNoise = function (t) {
    const ctx = A.ctx;
    const src = ctx.createBufferSource();
    src.buffer = A._noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 6;
    bp.frequency.setValueAtTime(900 + Math.random() * 1800, t);
    bp.frequency.linearRampToValueAtTime(700 + Math.random() * 2400, t + 0.7);
    const g = ctx.createGain();
    const v = 0.05 + 0.08 * A.loud;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.25);
    g.gain.linearRampToValueAtTime(0, t + 0.75);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(bp); bp.connect(g);
    if (pan) { pan.pan.value = Math.random() * 2 - 1; g.connect(pan); pan.connect(A.verbIn); pan.connect(A.dry); }
    else { g.connect(A.verbIn); }
    src.start(t, Math.random() * 2, 0.8);
  };

  A._birdSong = function (t) {
    const ctx = A.ctx;
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2600 + Math.random() * 1400;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const out = ctx.createGain();
    out.gain.value = 0.035 * (A.birdVol == null ? 1 : A.birdVol);
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; out.connect(pan); pan.connect(A.dry); pan.connect(A.verbIn); }
    else out.connect(A.dry);
    for (let i = 0; i < n; i++) {
      const s = t + i * (0.11 + Math.random() * 0.08);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(base, s);
      o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.4), s + 0.04);
      o.frequency.exponentialRampToValueAtTime(base * 0.9, s + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(1, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.09);
      o.connect(g); g.connect(out);
      o.start(s); o.stop(s + 0.1);
    }
  };

  /* -------------------------------------------------------------- */
  /*  breathing                                                     */
  /* -------------------------------------------------------------- */
  A.breathIn = function () {
    const ctx = A.ctx;
    if (!ctx) return;
    A.breathOut(true);
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = A._noise; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(350, t);
    bp.frequency.linearRampToValueAtTime(1300, t + 4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 4);
    src.connect(bp); bp.connect(g); g.connect(A.dry);
    const vg = ctx.createGain(); vg.gain.value = 0.3; g.connect(vg); vg.connect(A.verbIn);
    src.start(t);
    A._breath = { src, bp, g };
    // the pad leans in with you
    A.pad.gain.setTargetAtTime(0.42, t, 1.5);
  };

  A.breathOut = function (silent, full) {
    const ctx = A.ctx;
    if (!ctx || !A._breath) return;
    const t = ctx.currentTime;
    const b = A._breath;
    A._breath = null;
    const dur = silent ? 0.2 : 3.2;
    b.bp.frequency.cancelScheduledValues(t);
    b.bp.frequency.setValueAtTime(b.bp.frequency.value, t);
    b.bp.frequency.linearRampToValueAtTime(260, t + dur);
    b.g.gain.cancelScheduledValues(t);
    b.g.gain.setValueAtTime(b.g.gain.value, t);
    b.g.gain.linearRampToValueAtTime(0, t + dur);
    b.src.stop(t + dur + 0.1);
    A.pad.gain.setTargetAtTime(0.32, t, 2);
    if (full) {
      const tones = A._chordTones();
      A._pluck(tones[tones.length - 1] + 12, 0.25, t + 0.4, { dur: 4 });
    }
  };

  /* -------------------------------------------------------------- */
  /*  the state of things                                           */
  /* -------------------------------------------------------------- */
  A.update = function (o) {
    const ctx = A.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    A.loud = o.loud;
    A.act = o.act;
    const L = o.loud;
    const loudAct = o.act === 3 || (o.act === 4 && L > 0.05);
    A.wobbleDepth.gain.setTargetAtTime(3 + (loudAct ? 42 * L : 6 * L), t, 0.6);
    A.wobble.frequency.setTargetAtTime(0.31 + (loudAct ? 2.2 * L : 0), t, 1);
    A.tin.gain.setTargetAtTime(loudAct ? 0.0032 * L * L : 0, t, 1.2);
    A.dis.gain.setTargetAtTime(loudAct ? 0.06 * L : 0, t, 1);
    A.gritGain.gain.setTargetAtTime(loudAct ? 0.05 * L * L : 0, t, 0.8);
    A.padLP.frequency.setTargetAtTime(o.act === 4 && !loudAct ? 1400 : 850 + (loudAct ? 1600 * L : 300 * L), t, 1);
    A.rain.gain.setTargetAtTime(0.13 * o.rain * (loudAct ? 1 + L : 1), t, o.rain < 0.5 ? 4 : 1);
    A.room.gain.setTargetAtTime(o.act === 5 ? 0.04 : 0.11, t, 2);
    A.heart = o.heart || 0;
    A.heartVol = o.heartVol;
    A.birds = !!o.birds;
    A.birdVol = o.birdVol;
    const want = o.progression || 'night';
    if (want !== A.progression) {
      A.progression = want;
      A._chordIdx = PROG[want].chords.length - 1;
      A._nextChord = Math.max(A._nextChord, t + 0.5);
    }
  };

  // the edit moment. everything swells, and a melody plays what the words say.
  A.except = function () {
    const ctx = A.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    A.progression = 'night';
    A._chordIdx = 3;
    A._nextChord = t + 0.1;
    A.pad.gain.cancelScheduledValues(t);
    A.pad.gain.setTargetAtTime(0.55, t, 2);
    A.padLP.frequency.setTargetAtTime(1500, t, 3);
    // "a-ny-bo-dy can find love"
    const phrase1 = [[76, 0], [74, 0.55], [72, 1.1], [74, 1.65], [76, 2.2], [79, 3.0]];
    phrase1.forEach(([n, dt]) => A._pluck(n, 0.42, t + 0.6 + dt, { dur: 3.5 }));
  };
  A.exceptYou = function () {
    const ctx = A.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    // "ex-cept you" — it falls, and doesn't come back up
    [[76, 0], [74, 0.7], [69, 1.8]].forEach(([n, dt]) => A._pluck(n, 0.48, t + dt, { dur: 5 }));
    A._pluck(45, 0.5, t + 1.8, { dur: 6 });
    A.pad.gain.setTargetAtTime(0.32, t + 6, 4);
  };

  // everything stops
  A.cut = function (seconds) {
    const ctx = A.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    A.master.gain.cancelScheduledValues(t);
    A.master.gain.setValueAtTime(A.master.gain.value, t);
    A.master.gain.linearRampToValueAtTime(0, t + 0.04);
    if (seconds) A.master.gain.setTargetAtTime(A.muted ? 0 : 0.85, t + seconds, 2.5);
  };
  A.unCut = function () {
    if (!A.ctx) return;
    A.master.gain.setTargetAtTime(A.muted ? 0 : 0.85, A.ctx.currentTime, 2);
  };

  A.release = function (i) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    const tones = A._chordTones();
    tones.forEach((n, k) => A._pluck(n + 12, 0.22, t + k * 0.16, { dur: 4.5 }));
  };

  A.finalChord = function () {
    const ctx = A.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    [48, 55, 60, 64, 67, 71, 74].forEach((n, i) => A._pluck(n, 0.3, t + i * 0.09, { dur: 9 }));
  };

  root.Sound = A;
})(window);
