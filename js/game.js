/* except you. — the night itself. */
(function () {
  'use strict';

  const D = window.DATA, E = window.E, S = window.Sound, V = window.Visuals;
  const $ = id => document.getElementById(id);
  const qs = new URLSearchParams(location.search);
  const SPEED = Math.max(1, Number(qs.get('speed')) || 1);
  const FAST = qs.has('fast') ? 0.06 : 1;
  const SAVE_KEY = 'except-you.night.v1';
  const BASE_TITLE = 'except you.';
  const mobileMQ = window.matchMedia('(max-width: 899px)');
  const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  let s = null;           // the night
  let running = false;    // the loop is advancing time
  let busy = false;       // a moment has the screen
  let reduced = reducedMQ.matches;
  let tab = 'mind';
  const queue = [];       // story beats waiting for the screen to be free

  /* -------------------------------------------------------------- */
  /*  small things                                                   */
  /* -------------------------------------------------------------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  // a random line that hasn't come up recently
  const recent = [];
  const fresh = a => {
    const pool = a.filter(x => !recent.includes(x));
    const x = pick(pool.length ? pool : a);
    recent.push(x);
    if (recent.length > Math.min(14, Math.floor(a.length * 0.8))) recent.shift();
    return x;
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sleep = ms => new Promise(r => setTimeout(r, ms * FAST));
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  const NAMES = ['', ' thousand', ' million', ' billion', ' trillion', ' quadrillion', ' quintillion',
    ' sextillion', ' septillion', ' octillion', ' nonillion', ' decillion', ' undecillion', ' duodecillion'];
  function fmt(n) {
    if (!isFinite(n)) return 'too many';
    if (n < 0) n = 0;
    if (n < 10 && n % 1) return n.toFixed(1);
    if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
    const e = Math.floor(Math.log10(n) / 3);
    if (e < NAMES.length) return (n / Math.pow(10, e * 3)).toFixed(2) + NAMES[e];
    return n.toExponential(2);
  }
  function fmtRate(n) {
    if (n < 10) return n.toFixed(1);
    return fmt(n);
  }
  function fmtClock(m) {
    const h = Math.floor(m / 60), mm = Math.floor(m % 60);
    return `${h}:${String(mm).padStart(2, '0')} am`;
  }

  /* -------------------------------------------------------------- */
  /*  the night, saved                                               */
  /* -------------------------------------------------------------- */
  function newState() {
    return {
      v: 1, act: 0, t: 0, actT: 0, clock: D.clock.start, savedAt: Date.now(),
      thoughts: 0, lifetime: 0, longing: 0, quiet: 0,
      gens: Object.fromEntries(D.gens.map(g => [g.id, 0])),
      upgrades: {}, windows: {}, lit: 0, gone: [],
      released: [], relIds: [], L0: 0, L: 0,
      flags: { clk: {}, firstBuy: {} },
      stats: { clicks: 0, phone: 0, notifs: 0, breaths: 0, kept: [], seen: [], missed: 0, watchT: 0, fav: null, winClicks: {} },
      thoughtIdx: 0, lastThoughtT: 0, sel: null, catIdx: 0, loudNotifIdx: 0, voiceIdx: 0,
      timers: { notif: 9999, whisper: 40, light: D.lightInterval, voice: 6, voiceLine: 10, floater: 5, dark: 34, drift: 4, glitch: 8, thought: 25 },
      log: [],
    };
  }

  const store = {
    get() { try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(SAVE_KEY, v); } catch (e) { /* the night just won't be remembered */ } },
    del() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nothing to forget */ } },
  };
  let hotSave = null;

  function save() {
    if (!s || s.act === 0) return;
    s.savedAt = Date.now();
    store.set(JSON.stringify(s));
  }
  function parseSave(raw) {
    if (!raw) return null;
    try {
      const o = JSON.parse(raw);
      if (!o || o.v !== 1 || !o.act) return null;
      const base = newState();
      const merged = Object.assign(base, o);
      merged.gens = Object.assign(base.gens, o.gens);
      merged.flags = Object.assign({ clk: {}, firstBuy: {} }, o.flags);
      merged.stats = Object.assign(newState().stats, o.stats);
      merged.timers = Object.assign(newState().timers, o.timers);
      return merged;
    } catch (e) { return null; }
  }

  /* -------------------------------------------------------------- */
  /*  elements                                                       */
  /* -------------------------------------------------------------- */
  const ui = {};
  ['app', 'clock', 'mini', 'btn-sound', 'btn-menu', 'counter', 'count', 'count-label', 'rate', 'longing-count', 'quiet-count',
    'main-btn', 'breath', 'breath-text', 'breath-hint', 'whisper-slot', 'choice', 'log', 'kept-wrap', 'kept-btn', 'kept-list',
    'panel-mind', 'panel-window', 'panel-habits', 'window-meta', 'building-wrap', 'building', 'win-hits', 'cap-id', 'cap-text',
    'cap-actions', 'habits-title', 'habits-sub', 'upgrades', 'gens', 'tabs', 'pops', 'floaters', 'toasts', 'menu',
    'm-sound', 'm-motion', 'm-reset', 'm-confirm', 'm-reset-yes', 'm-reset-no', 'cinema', 'cinema-canvas', 'cinema-text',
    'cinema-choices', 'cinema-skip', 'title', 't-begin', 't-continue', 't-new', 't-confirm', 't-new-yes', 't-new-no', 'drift', 'bg',
  ].forEach(id => { ui[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = $(id); });
  const breathCore = ui.breath.querySelector('.breath-core');

  /* -------------------------------------------------------------- */
  /*  the log                                                        */
  /* -------------------------------------------------------------- */
  function log(text, cls, opts) {
    opts = opts || {};
    if (!text) return;
    s.log.unshift([text, cls || '']);
    if (s.log.length > 36) s.log.length = 36;
    const li = el('li', cls || '');
    const sr = el('span', 'sr', text);
    const typed = el('span');
    typed.setAttribute('aria-hidden', 'true');
    li.append(sr, typed);
    ui.log.prepend(li);
    while (ui.log.children.length > 36) ui.log.lastChild.remove();
    if (opts.instant || reduced) { typed.textContent = text; return; }
    li.classList.add('caret');
    let i = 0;
    const speed = cls === 'voice' ? 22 : 34;
    const step = () => {
      i = Math.min(text.length, i + 2);
      typed.textContent = text.slice(0, i);
      if (i < text.length) setTimeout(step, speed);
      else li.classList.remove('caret');
    };
    step();
  }
  function renderLog() {
    ui.log.innerHTML = '';
    for (let i = s.log.length - 1; i >= 0; i--) {
      const [text, cls] = s.log[i];
      const li = el('li', cls);
      li.append(el('span', 'sr', text));
      const typed = el('span', null, text);
      typed.setAttribute('aria-hidden', 'true');
      li.append(typed);
      ui.log.prepend(li);
    }
  }

  function pop(x, y, text, cls) {
    const p = el('span', 'pop' + (cls ? ' ' + cls : ''), text);
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    ui.pops.append(p);
    setTimeout(() => p.remove(), 1150);
  }
  function popAt(node, text, cls) {
    const r = node.getBoundingClientRect();
    pop(r.left + r.width / 2 + rand(-20, 20), r.top + rand(-4, 6), text, cls);
  }

  /* -------------------------------------------------------------- */
  /*  the moments                                                    */
  /* -------------------------------------------------------------- */
  const C = {
    _skip: null,
    open(mode) {
      busy = true;
      ui.cinema.hidden = false;
      ui.cinema.className = 'cinema ' + (mode || '');
      ui.cinemaText.innerHTML = '';
      ui.cinemaChoices.innerHTML = '';
      ui.cinemaCanvas.classList.remove('on');
      ui.cinemaSkip.hidden = false;
    },
    line(text, cls) {
      const p = el('p', 'c-line ' + (cls || ''), text);
      ui.cinemaText.append(p);
      requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('on')));
      return p;
    },
    wait(ms) {
      return new Promise(res => {
        const start = performance.now();
        let done = false;
        const finish = () => { if (done) return; done = true; clearTimeout(timer); C._skip = null; res(); };
        const timer = setTimeout(finish, ms * FAST);
        C._skip = () => { if (performance.now() - start > 650) finish(); };
      });
    },
    async clear() {
      for (const p of ui.cinemaText.children) p.classList.remove('on');
      await sleep(1300);
      ui.cinemaText.innerHTML = '';
    },
    choose(options, cls) {
      ui.cinemaSkip.hidden = true;
      return new Promise(res => {
        ui.cinemaChoices.innerHTML = '';
        options.forEach((o, i) => {
          const b = el('button', 'choice-btn ' + (cls || ''), o);
          b.type = 'button';
          b.addEventListener('click', ev => {
            ev.stopPropagation();
            ui.cinemaChoices.innerHTML = '';
            ui.cinemaSkip.hidden = false;
            res(i);
          });
          ui.cinemaChoices.append(b);
        });
        const first = ui.cinemaChoices.querySelector('button');
        if (first) first.focus({ preventScroll: true });
      });
    },
    async close() {
      ui.cinema.classList.add('out');
      await sleep(1500);
      ui.cinema.hidden = true;
      ui.cinema.className = 'cinema';
      ui.cinemaText.innerHTML = '';
      cinemaScene = null;
      busy = false;
    },
  };
  ui.cinema.addEventListener('click', () => C._skip && C._skip());
  document.addEventListener('keydown', e => {
    if (!ui.cinema.hidden && (e.key === ' ' || e.key === 'Enter') && !ui.cinemaChoices.children.length && C._skip) {
      e.preventDefault();
      C._skip();
    }
  });

  // a picture behind the words, for the moments that need one
  let cinemaScene = null;
  function drawCinema(t) {
    if (!cinemaScene) return;
    const cv = ui.cinemaCanvas;
    const wins = {};
    for (const w of D.windows) {
      const lit = w.lines || w.pose === 'cat' || w.pose === 'lamp';
      wins[w.id] = { lit, stage: 3 };
    }
    V.drawBuilding(cv, { windows: wins, t, allLit: true, labels: false, reflection: cinemaScene.reflection, loud: 0 });
  }

  /* -------------------------------------------------------------- */
  /*  tabs (phones)                                                  */
  /* -------------------------------------------------------------- */
  const panels = { mind: ui.panelMind, window: ui.panelWindow, habits: ui.panelHabits };
  const tabBtns = [...ui.tabs.querySelectorAll('.tab')];
  function setTab(name) {
    tab = name;
    for (const k in panels) panels[k].classList.toggle('tab-off', mobileMQ.matches && k !== name);
    for (const b of tabBtns) {
      const on = b.dataset.tab === name;
      b.classList.toggle('is-on', on);
      if (on) b.classList.remove('dot');
      b.setAttribute('aria-current', on ? 'page' : 'false');
    }
    if (name === 'window') requestAnimationFrame(positionHits);
  }
  function visible(name) {
    if (panels[name].hidden) return false;
    return !mobileMQ.matches || tab === name;
  }
  function dot(name) {
    if (visible(name)) return;
    const b = tabBtns.find(x => x.dataset.tab === name);
    if (b && !b.hidden) b.classList.add('dot');
  }
  tabBtns.forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  mobileMQ.addEventListener('change', () => setTab(tab));

  /* -------------------------------------------------------------- */
  /*  the shape of the screen, from the state                        */
  /* -------------------------------------------------------------- */
  function applyUI() {
    document.body.classList.toggle('act3', s.act === 3);
    document.body.classList.toggle('act4', s.act >= 4);
    ui.counter.hidden = !s.flags.counter;
    const habits = !!s.flags.habits;
    reveal(ui.panelHabits, habits);
    reveal(ui.panelWindow, s.act >= 2);
    ui.app.classList.toggle('has-habits', habits);
    ui.app.classList.toggle('has-window', s.act >= 2);
    ui.tabs.hidden = !habits;
    ui.app.classList.toggle('has-tabs', habits);
    tabBtns.find(b => b.dataset.tab === 'window').hidden = s.act < 2;
    ui.longingCount.hidden = s.act !== 2;
    ui.quietCount.hidden = s.act < 4;

    const breathing = s.act >= 4;
    ui.mainBtn.hidden = breathing;
    ui.breath.hidden = !breathing || s.act >= 5;
    ui.breathHint.hidden = !breathing || s.act >= 5 || (s.stats.breaths >= 3 && !s.flags.silence);
    mainLabel(true);
    ui.habitsTitle.textContent = s.act >= 4 ? 'let go' : 'habits';
    ui.habitsSub.textContent = s.act >= 4 ? 'one thing at a time' : 'things you do instead of sleeping';
    ui.buildingWrap.classList.toggle('curtained', !!s.flags.curtain);
    renderKept();
    buildGens();
    buildUpgrades();
    renderCaption();
    setTab(tab);
  }

  // a panel fades in once, the first time it exists. switching tabs is instant.
  function reveal(panel, show) {
    if (show && panel.hidden) {
      panel.hidden = false;
      panel.classList.add('reveal');
      setTimeout(() => panel.classList.remove('reveal'), 1700);
    } else if (!show) panel.hidden = true;
  }

  function mainLabel(force) {
    let label = 'stare at the ceiling';
    if (s.act === 2) label = 'think about them';
    if (s.act === 3) {
      const t = s.actT;
      label = t < 40 ? 'think' : t < 90 ? 'think about it' : t < 150 ? "don't think about it" : t < 210 ? 'stop thinking about it' : t < 260 ? 'stop' : 'STOP';
    }
    if (force || ui.mainBtn.textContent !== label) ui.mainBtn.textContent = label;
    ui.mainBtn.classList.toggle('loud', s.act === 3 && s.actT > 150);
  }

  /* -------------------------------------------------------------- */
  /*  habits                                                         */
  /* -------------------------------------------------------------- */
  let genRows = {};
  let genKey = '';
  const fadingOut = new Set();
  function genVisible(g) {
    if (s.act >= 4) return s.relIds.includes(g.id) && (!s.released.includes(g.id) || fadingOut.has(g.id));
    if (g.auto) return s.gens[g.id] > 0;
    if (g.act > s.act) return false;
    return s.gens[g.id] > 0 || s.lifetime >= g.cost * 0.4;
  }
  function buildGens() {
    const list = D.gens.filter(genVisible);
    const key = s.act + ':' + list.map(g => g.id).join(',');
    if (key === genKey) return;
    genKey = key;
    ui.gens.innerHTML = '';
    genRows = {};
    for (const g of list) {
      const b = el('button', 'gen');
      b.type = 'button';
      const name = el('span', 'gen-name');
      const count = el('span', 'gen-count');
      const desc = el('span', 'gen-desc');
      const cost = el('span', 'gen-cost');
      b.append(name, count, desc, cost);
      if (s.act >= 4) {
        b.classList.add('release');
        if (fadingOut.has(g.id)) b.classList.add('gone');
        name.textContent = g.release;
        desc.textContent = g.auto ? "it's been talking all night." : `${g.name}. you did it ${fmt(s.gens[g.id])} times tonight.`;
        count.textContent = '';
        b.addEventListener('click', () => releaseGen(g.id, b));
      } else {
        name.textContent = g.name;
        desc.textContent = g.desc;
        if (g.auto) b.classList.add('voice');
        b.addEventListener('click', () => buyGen(g.id, b));
      }
      ui.gens.append(b);
      genRows[g.id] = { b, name, count, desc, cost, g };
    }
    if (!list.length && s.act >= 4) ui.gens.append(el('p', 'gen-desc', 'nothing left to let go of.'));
  }
  function updateGens() {
    buildGens();
    const glitchOn = s.act === 3 && s.glitchId;
    for (const id in genRows) {
      const r = genRows[id], g = r.g;
      if (s.act >= 4) {
        const c = E.releaseCost(s);
        const lockedVoice = g.auto && s.released.length < s.relIds.length - 1;
        r.b.classList.toggle('locked', lockedVoice);
        r.b.classList.toggle('poor', !lockedVoice && s.quiet < c);
        r.cost.innerHTML = lockedVoice ? 'not yet. let go of the rest first.' : `let go · <b>${fmt(c)}</b> quiet`;
        continue;
      }
      const n = s.gens[id];
      r.count.textContent = fmt(n);
      if (g.auto) {
        r.cost.textContent = `×${fmt(Math.pow(1.08, n))} to everything · it grows on its own`;
      } else {
        const c = E.genCost(g, n);
        r.cost.innerHTML = `<b>${fmt(c)}</b> thoughts · +${fmtRate(E.genRate(s, g))}/s each`;
        r.b.classList.toggle('poor', s.thoughts < c);
      }
      const glitch = glitchOn === id;
      const nm = glitch ? g.glitch : g.name;
      if (r.name.textContent !== nm) r.name.textContent = nm;
    }
  }
  function buyGen(id, b) {
    if (busy || s.act >= 4) return;
    const g = E.gen(id);
    if (g.auto) { log(pick(['you can’t get rid of it like that.', 'it isn’t for sale. it was never for sale.']), 'voice'); return; }
    const c = E.genCost(g, s.gens[id]);
    if (s.thoughts < c) { shake(b); return; }
    s.thoughts -= c;
    s.gens[id]++;
    S.buy();
    if (!s.flags.firstBuy[id]) {
      s.flags.firstBuy[id] = true;
      log(FIRST_BUY[id], s.act === 3 ? 'voice' : '');
      if (id === 'phone') s.timers.notif = 22;
    }
    updateGens();
  }
  const FIRST_BUY = {
    replay: "you play the conversation back. you pause on the part where you said 'lol' instead of something real.",
    phone: 'the phone is so bright in the dark. no new messages. you check again anyway.',
    reread: 'you scroll up. and up. back to when they used to send paragraphs.',
    imagine: 'you build a whole other life on the ceiling. it’s a nice one. you live there for a while.',
    scroll: 'your thumb knows this motion better than it knows anything.',
    compare: 'everyone your age is doing so well. you can tell from the pictures.',
    drafts: "'hey. i know it's late. i just' — you delete it. you write it again.",
    song: 'the slowed + reverb version. with the rain sounds layered in. as if you needed more rain.',
    wrong: 'you go looking for the thing that’s wrong with you. there are so many candidates.',
    argue: "'just text them.' 'no.' 'why not.' 'you know why not.'",
    cracks: 'one. two. three. it gives your eyes something to do.',
  };
  function shake(b) {
    b.classList.remove('shake');
    void b.offsetWidth;
    b.classList.add('shake');
  }

  /* upgrades */
  let upKey = '';
  const upBtns = {};
  function upVisible(u) {
    if (s.act >= 4 || s.upgrades[u.id] || u.act > s.act) return false;
    if (!u.req(s)) return false;
    return u.story || s.lifetime >= u.cost * 0.35;
  }
  function buildUpgrades() {
    const list = D.upgrades.filter(upVisible);
    const key = list.map(u => u.id).join(',');
    if (key === upKey) return;
    upKey = key;
    ui.upgrades.innerHTML = '';
    for (const id in upBtns) delete upBtns[id];
    for (const u of list) {
      const b = el('button', 'up');
      b.type = 'button';
      if (u.story) b.classList.add('story');
      if (u.id.startsWith('stop')) b.classList.add('stop');
      if (u.id === 'stop3') b.classList.add('final');
      b.append(el('span', 'up-name', u.name), el('span', 'up-cost', fmt(u.cost)));
      b.title = u.line || '';
      b.addEventListener('click', () => buyUpgrade(u, b));
      ui.upgrades.append(b);
      upBtns[u.id] = b;
    }
    if (list.length) dot('habits');
  }
  function updateUpgrades() {
    buildUpgrades();
    for (const id in upBtns) {
      const u = D.upgrades.find(x => x.id === id);
      const can = s.thoughts >= u.cost;
      upBtns[id].classList.toggle('can', can);
      upBtns[id].classList.toggle('poor', !can);
    }
  }
  function buyUpgrade(u, b) {
    if (busy) return;
    if (s.thoughts < u.cost) { shake(b); return; }
    s.thoughts -= u.cost;
    s.upgrades[u.id] = true;
    S.buy();
    if (u.line) log(u.line, s.act === 3 ? 'voice' : '');
    if (u.voices) s.gens.voice += u.voices;
    if (u.notifs) s.timers.notif = Math.min(s.timers.notif, 12);
    if (u.id === 'stop2' && !s.flags.foreshadow) queue.push(foreshadow);
    if (u.story === 'act2') toAct2();
    if (u.story === 'act4') theBreak();
    updateUpgrades();
    updateGens();
  }

  /* -------------------------------------------------------------- */
  /*  your head                                                      */
  /* -------------------------------------------------------------- */
  function clickMain(ev) {
    if (busy || s.act < 1 || s.act > 3) return;
    const v = E.clickValue(s);
    s.thoughts += v;
    s.lifetime += v;
    s.stats.clicks++;
    S.click();
    const x = ev && ev.clientX ? ev.clientX : null;
    if (x != null && ev.detail) pop(x + rand(-10, 10), ev.clientY - 12, '+' + fmt(v));
    else popAt(ui.mainBtn, '+' + fmt(v));
    ui.mainBtn.classList.remove('pulse');

    if (s.act === 1 && s.thoughtIdx < D.firstThoughts.length) {
      log(D.firstThoughts[s.thoughtIdx++]);
      s.lastThoughtT = s.t;
    } else if (s.act <= 2 && s.t - s.lastThoughtT > 14 && Math.random() < 0.12) {
      log(fresh(D.moreThoughts));
      s.lastThoughtT = s.t;
    }
  }
  ui.mainBtn.addEventListener('click', clickMain);

  function renderKept() {
    const k = s.stats.kept;
    ui.keptWrap.hidden = !k.length;
    ui.keptBtn.textContent = `kept · ${k.length}`;
    ui.keptList.innerHTML = '';
    for (const i of k) ui.keptList.append(el('li', null, D.whispers[i]));
  }
  ui.keptBtn.addEventListener('click', () => {
    const open = ui.keptList.hidden;
    ui.keptList.hidden = !open;
    ui.keptBtn.setAttribute('aria-expanded', String(open));
  });

  /* the quiet voice */
  function spawnWhisper() {
    const pool = [];
    for (let i = 0; i < D.whispers.length - 1; i++) if (!s.stats.seen.includes(i)) pool.push(i);
    if (!pool.length) for (let i = 0; i < D.whispers.length - 1; i++) if (!s.stats.kept.includes(i)) pool.push(i);
    if (!pool.length) return;
    const i = pool[0];
    if (!s.stats.seen.includes(i)) s.stats.seen.push(i);
    ui.whisperSlot.innerHTML = '';
    const b = el('button', 'whisper', D.whispers[i]);
    b.type = 'button';
    const dur = s.act === 3 ? 6 : 10;
    b.style.setProperty('--wdur', dur + 's');
    b.style.setProperty('--wpeak', s.act === 3 ? '0.3' : '0.42');
    let kept = false;
    b.addEventListener('click', () => {
      if (kept) return;
      kept = true;
      if (!s.stats.kept.includes(i)) s.stats.kept.push(i);
      S.keep();
      b.classList.add('kept');
      b.textContent = D.whispers[i] + '  · kept';
      renderKept();
      setTimeout(() => b.classList.add('gone'), 600);
      setTimeout(() => b.remove(), 4200);
    });
    b.addEventListener('animationend', () => {
      if (!kept) { s.stats.missed++; b.remove(); }
    });
    ui.whisperSlot.append(b);
  }

  /* the phone */
  function toast(o) {
    const t = el('button', 'toast' + (o.loud ? ' loud' : ''));
    t.type = 'button';
    const head = el('div', 'toast-head');
    head.append(el('span', 'toast-icon' + (o.msg ? ' msg' : '')), el('span', 'toast-app', o.msg ? 'messages' : 'feed'), el('span', 'toast-time', 'now'));
    const body = el('div', 'toast-body');
    const who = el('b', null, o.from);
    body.append(who, document.createTextNode(' ' + o.text));
    t.append(head, body);
    ui.toasts.append(t);
    while (ui.toasts.children.length > 3) ui.toasts.firstChild.remove();
    S.ding(o.loud ? 'loud' : '');
    V.phoneGlow = 1;
    let gone = false;
    const dismiss = () => {
      if (gone) return;
      gone = true;
      t.classList.add('out');
      setTimeout(() => t.remove(), 460);
    };
    t.addEventListener('click', () => { if (!gone) { dismiss(); o.onOpen && o.onOpen(t); } });
    setTimeout(() => { if (!gone) { dismiss(); o.onMiss && o.onMiss(); } }, o.life || 9000);
    return { el: t, body, who, dismiss };
  }

  function spawnNotif() {
    if (s.act === 2 && !s.flags.themPost && E.stagesTotal(s) >= 20) {
      s.flags.themPost = true;
      toast({
        from: 'them', text: 'posted a new photo', life: 14000,
        onOpen: () => {
          queue.push(async () => {
            log("it's them.", 'big', {});
            await sleep(1800); log('with someone.');
            await sleep(2200); log('they look happy. they look so happy.');
            await sleep(2600); log("you zoom in. you shouldn't zoom in.");
            s.longing += 40 + E.longingRate(s) * 30;
            gainThoughts(Math.max(500, E.production(s) * 90));
          });
        },
        onMiss: () => log("you didn't open it. you saw the preview anyway. it's them, with someone. they look happy."),
      });
      return;
    }
    if (s.act === 3) {
      if (!s.flags.samLoud && s.actT > 70) {
        s.flags.samLoud = true;
        toast({
          from: 'sam', text: "sent a video: 'this is so you lmao'", msg: true, loud: true,
          onOpen: () => {
            log("sam sent you something. you don't watch it.");
            setTimeout(() => log("they're just being nice. everyone is just being nice.", 'voice'), 1600);
            gainThoughts(E.production(s) * 20);
          },
        });
        return;
      }
      const n = D.loudNotifs[s.loudNotifIdx++ % D.loudNotifs.length];
      const tt = toast({
        from: n.from, text: n.text, loud: true, msg: true,
        onOpen: () => { log(n.open, 'voice'); gainThoughts(E.production(s) * 30); },
      });
      if (n.typing) {
        setTimeout(() => { tt.body.lastChild.textContent = ' stopped typing'; }, 3600);
      }
      return;
    }
    const n = pick(D.notifs);
    toast({
      from: n.from, text: n.text,
      onOpen: () => {
        s.stats.notifs++;
        log(fresh(D.notifOpened));
        gainThoughts(Math.max(25, E.production(s) * 40));
        if (s.act === 2) {
          const l = 10 + E.longingRate(s) * 10;
          s.longing += l;
        }
      },
    });
  }
  function gainThoughts(n) {
    s.thoughts += n;
    s.lifetime += n;
    if (!ui.counter.hidden) popAt(ui.count, '+' + fmt(n));
  }

  /* the loud ones */
  function spawnFloater(text) {
    const b = el('button', 'floater', text || pick(D.loudFragments));
    b.type = 'button';
    const W = window.innerWidth, H = window.innerHeight;
    const fromLeft = Math.random() < 0.5;
    b.style.left = (fromLeft ? rand(-5, 25) : rand(55, 80)) + '%';
    b.style.top = rand(12, 82) + '%';
    b.style.fontSize = rand(20, 20 + 22 * V.loud) + 'px';
    b.style.setProperty('--fdur', rand(9, 16) + 's');
    b.style.setProperty('--fx', (fromLeft ? 1 : -1) * rand(W * 0.2, W * 0.5) + 'px');
    b.style.setProperty('--fy', rand(-H * 0.15, H * 0.15) + 'px');
    b.addEventListener('click', () => {
      b.classList.add('popped');
      S.click();
      const v = Math.max(E.clickValue(s), E.production(s) * 3);
      gainThoughts(v);
      setTimeout(() => b.remove(), 500);
    });
    b.addEventListener('animationend', e => { if (e.animationName === 'float-across') b.remove(); });
    ui.floaters.append(b);
  }

  function voiceLine() {
    const missed = s.stats.missed;
    let lines = D.voiceLines.slice();
    if (missed > 0) lines.push(D.voiceMissed);
    const order = s.voiceIdx++;
    let line = order < lines.length ? lines[(order * 7) % lines.length] : pick(lines);
    const fav = s.stats.fav || '5b';
    line = line
      .replace(/\{phone\}/g, fmt(Math.floor(s.stats.phone)))
      .replace(/\{clicks\}/g, fmt(s.stats.clicks))
      .replace(/\{fav\}/g, fav)
      .replace(/\{clock\}/g, fmtClock(s.clock))
      .replace(/\{watch\}/g, String(Math.max(1, Math.round(s.stats.watchT / 60))))
      .replace(/\{missed\}/g, String(missed));
    log(line, 'voice');
  }

  /* -------------------------------------------------------------- */
  /*  the window                                                     */
  /* -------------------------------------------------------------- */
  const hitBtns = {};
  function buildHits() {
    ui.winHits.innerHTML = '';
    for (const w of D.windows) {
      const b = el('button', 'win-hit');
      b.type = 'button';
      b.setAttribute('aria-label', 'window ' + w.id);
      b.addEventListener('click', () => selectWindow(w.id));
      ui.winHits.append(b);
      hitBtns[w.id] = b;
    }
  }
  function positionHits() {
    const W = ui.building.clientWidth, H = ui.building.clientHeight;
    if (!W || !H) return;
    const L = V.layout(W, H);
    for (const id in hitBtns) {
      const r = L.rects[id];
      const b = hitBtns[id];
      b.style.left = ((r.x - 6) / W * 100) + '%';
      b.style.top = ((r.y - 6) / H * 100) + '%';
      b.style.width = ((r.w + 12) / W * 100) + '%';
      b.style.height = ((r.h + 26) / H * 100) + '%';
    }
  }
  window.addEventListener('resize', () => requestAnimationFrame(positionHits));
  if (window.ResizeObserver) new ResizeObserver(() => positionHits()).observe(ui.buildingWrap);
  document.addEventListener('pointerdown', () => S.resume(), { passive: true });

  function isLit(id) {
    if (s.gone.includes(id)) return false;
    if (id === '6d') return !!s.flags.sixLit || (s.flags.flickerOn && s.act === 3);
    if (s.act >= 3) {
      const w = D.windows.find(x => x.id === id);
      return !!(w.lines || w.pose === 'cat' || w.pose === 'lamp');
    }
    return s.act >= 2 && D.lightOrder.indexOf(id) > -1 && D.lightOrder.indexOf(id) < s.lit;
  }

  function selectWindow(id) {
    if (busy) return;
    s.sel = id;
    s.stats.winClicks[id] = (s.stats.winClicks[id] || 0) + 1;
    hitBtns[id] && hitBtns[id].classList.remove('new');
    const w = D.windows.find(x => x.id === id);
    if (w.lines && s.act === 2 && isLit(id) && !s.windows[id]) {
      s.windows[id] = 1;
      log(w.lines[0], 'window');
      S.buy();
    }
    if (w.pose === 'cat' && isLit(id)) {
      if (!s.flags.cat) { s.flags.cat = true; }
      s.catIdx = Math.min(D.catLines.length - 1, (s.catIdx || 0) + 1);
    }
    renderCaption();
  }

  function renderCaption() {
    const id = s.sel;
    ui.capActions.innerHTML = '';
    if (!id) {
      ui.capId.textContent = '';
      ui.capText.textContent = s.act >= 4 ? 'most of the lights are out now.' : s.act === 3 ? 'they are all so happy over there.' : 'some of the lights are still on. tap one.';
      return;
    }
    const w = D.windows.find(x => x.id === id);
    ui.capId.textContent = 'apt. ' + id;
    const lit = isLit(id);
    ui.capText.className = 'cap-text';

    if (id === '6d') return captionSixD(lit);
    if (s.act >= 4) {
      ui.capText.textContent = w.pose === 'cat' ? D.catLines[2] : w.lines ? "dark. they're asleep. good." : w.text;
      return;
    }
    if (!lit) {
      ui.capText.textContent = s.gone.includes(id) ? "dark now. they're asleep. together." : w.lines ? 'dark. maybe later.' : w.text;
      return;
    }
    if (w.pose === 'cat') {
      ui.capText.textContent = s.flags.cat ? D.catLines[Math.min(D.catLines.length - 2, Math.max(0, (s.catIdx || 1) - 1))] : w.text;
      return;
    }
    if (!w.lines) { ui.capText.textContent = w.text; return; }
    const st = s.windows[id] || 0;
    if (s.act === 3) {
      ui.capText.textContent = w.lines[2];
      const v = el('p', 'cap-text', "you'll never have that.");
      v.style.color = '#e8a39b';
      ui.capActions.append(v);
      return;
    }
    ui.capText.textContent = w.lines[Math.max(0, st - 1)];
    if (st >= 1 && st < 3) {
      const c = E.stageCost(s, st + 1);
      const b = el('button', 'cap-btn');
      b.type = 'button';
      b.append(document.createTextNode('keep watching'), el('span', 'up-cost', `${fmt(c)} longing`));
      b.setAttribute('aria-disabled', String(s.longing < c));
      b.addEventListener('click', () => keepWatching(id, b));
      ui.capActions.append(b);
    } else if (st >= 3) {
      ui.capActions.append(el('p', 'cap-id', "you've seen enough. you keep looking anyway."));
    }
  }
  function refreshCaptionButton() {
    const b = ui.capActions.querySelector('.cap-btn');
    if (!b || !s.sel || s.act !== 2) return;
    const st = s.windows[s.sel] || 0;
    if (st < 1 || st >= 3) return;
    b.setAttribute('aria-disabled', String(s.longing < E.stageCost(s, st + 1)));
  }

  function keepWatching(id, b) {
    if (busy || s.act !== 2) return;
    const st = s.windows[id] || 0;
    if (st < 1 || st >= 3) return;
    const c = E.stageCost(s, st + 1);
    if (s.longing < c) { shake(b); return; }
    s.longing -= c;
    s.windows[id] = st + 1;
    const w = D.windows.find(x => x.id === id);
    log(w.lines[st], 'window');
    S.buy();
    if (st + 1 === 3 && !s.stats.fav) s.stats.fav = id;
    renderCaption();
    if (E.stagesTotal(s) >= D.storyWindowIds.length * 3 && !s.flags.exceptQueued) {
      s.flags.exceptQueued = true;
      queue.push(exceptYou);
    }
  }

  function captionSixD(lit) {
    const f = s.flags;
    if (!lit) {
      ui.capText.textContent = s.act === 3 && f.flickered ? 'for a second there was a light. then nothing.' : 'dark. top floor.';
      return;
    }
    if (s.act === 3) { ui.capText.textContent = 'a light. someone. then'; return; }
    if (f.curtain) { ui.capText.textContent = 'the curtain is closed. the dark is yours for a while.'; return; }
    if (!f.waved) {
      ui.capText.textContent = "someone alone at the window, lit by their phone. they're looking out at the rain. at your building. at your window, maybe.";
      const a = el('button', 'cap-btn', 'wave');
      const b = el('button', 'cap-btn', 'close the curtain');
      a.type = b.type = 'button';
      a.addEventListener('click', () => {
        f.waved = true;
        S.release();
        waveT = performance.now();
        log('you lift your hand. you feel ridiculous. a long second.', 'quiet');
        setTimeout(() => { log('then, across the street, they lift theirs.', 'quiet'); waveBackT = performance.now(); renderCaption(); }, 2600 * FAST);
        setTimeout(() => { f.sign = true; S.ding(); renderCaption(); dot('window'); }, 16000 * FAST);
        renderCaption();
      });
      b.addEventListener('click', () => {
        f.curtain = true;
        ui.buildingWrap.classList.add('curtained');
        log("you close the curtain. not to hide. you just want the dark to be yours for a while.", 'quiet');
        renderCaption();
      });
      ui.capActions.append(a, b);
      return;
    }
    if (!f.sign) { ui.capText.textContent = 'they waved back. they waved back.'; return; }
    if (!f.nodded) {
      ui.capText.textContent = "they're holding a sheet of paper against the glass. in thick marker it says: CAN'T SLEEP EITHER?";
      const a = el('button', 'cap-btn', 'nod');
      a.type = 'button';
      a.addEventListener('click', () => {
        f.nodded = true;
        S.release();
        log("you nod. they laugh. you can't hear it, but you can see it.", 'quiet');
        setTimeout(() => log("you were never the only one. there's always a light on somewhere at 3 am. someone is always the 'except you'.", 'quiet'), 3200 * FAST);
        renderCaption();
      });
      ui.capActions.append(a);
      return;
    }
    ui.capText.textContent = "6d. a stranger, awake, like you. it's strange how much that helps.";
  }
  let waveT = 0, waveBackT = 0;

  function windowState(t) {
    const out = {};
    for (const w of D.windows) {
      const o = { lit: isLit(w.id), stage: s.act >= 3 ? 3 : (s.windows[w.id] || 0) };
      if (s.act >= 3 && s.gone.includes(w.id)) o.gone = true;
      if (s.act === 3 && V.loud > 0.6 && Math.random() < 0.02) o.flick = rand(0.3, 0.8);
      if (w.id === '6d') {
        o.stage = 1;
        if (waveBackT) {
          const k = (performance.now() - waveBackT) / 1000;
          o.wave = k < 4 ? Math.abs(Math.sin(k * 3)) : 0;
        }
        if (s.flags.sign) o.sign = true;
      }
      if (s.act >= 4 && w.id !== '6d' && s.released.length >= (s.relIds.length * 0.5) && w.pose !== 'cat') o.lit = false;
      out[w.id] = o;
    }
    return out;
  }

  /* -------------------------------------------------------------- */
  /*  act 1 → 2                                                      */
  /* -------------------------------------------------------------- */
  async function toAct2() {
    C.open('clear');
    await sleep(600);
    C.line('you pull the curtain back.');
    await C.wait(2400);
    C.line("the building across the street is still awake. not all of it. enough of it.");
    await C.wait(3200);
    C.line("you tell yourself you're just looking at the rain.", 'dim');
    await C.wait(2800);
    s.act = 2;
    s.actT = 0;
    s.lit = 3;
    s.timers.light = D.lightInterval;
    s.sel = null;
    applyUI();
    await C.close();
    log('across the street, a few windows are still lit.', 'window');
    for (const id of D.lightOrder.slice(0, 3)) if (hitBtns[id]) hitBtns[id].classList.add('new');
    if (mobileMQ.matches) setTab('window');
    positionHits();
    save();
  }

  /* -------------------------------------------------------------- */
  /*  the edit                                                       */
  /* -------------------------------------------------------------- */
  async function exceptYou() {
    await sleep(3800);
    C.open('black');
    cinemaScene = { reflection: 0 };
    ui.cinemaCanvas.classList.add('on');
    ui.cinemaSkip.hidden = true;
    await sleep(2400);
    S.except();
    C.line('anybody can find love.', 'c-big');
    await sleep(4600);
    S.exceptYou();
    C.line('except you.', 'c-big');
    await sleep(4200);
    const t0 = performance.now();
    await new Promise(res => {
      const step = () => {
        const k = clamp((performance.now() - t0) / (3200 * FAST), 0, 1);
        cinemaScene.reflection = k;
        if (k < 1) requestAnimationFrame(step); else res();
      };
      step();
    });
    C.line("in the glass, laid over all of their windows, there's you. one person. a little blurry. the only one.", 'dim');
    ui.cinemaSkip.hidden = false;
    await C.wait(5200);
    await C.clear();
    ui.cinemaCanvas.classList.remove('on');
    C.line('it gets loud.', 'voice');
    await C.wait(2400);
    startAct3();
    await C.close();
  }

  function startAct3() {
    s.act = 3;
    s.actT = 0;
    s.clock = 4 * 60 + 44;
    s.gens.voice = Math.max(1, s.gens.voice);
    s.flags.act3 = true;
    s.timers.voice = 6; s.timers.voiceLine = 8; s.timers.floater = 4; s.timers.dark = 30; s.timers.notif = 18; s.timers.whisper = 50;
    s.sel = null;
    applyUI();
    log("something else is here now. it talks like you.", 'voice');
    save();
  }

  async function foreshadow() {
    s.flags.foreshadow = true;
    await sleep(1200);
    ui.breath.hidden = false;
    ui.breathText.textContent = 'breathe';
    ui.breath.classList.add('resting');
    await sleep(3200);
    log('no. not yet. keep going.', 'voice');
    await sleep(900);
    ui.breath.hidden = true;
    ui.breath.classList.remove('resting');
    ui.breathText.textContent = 'hold';
  }

  /* -------------------------------------------------------------- */
  /*  the break                                                      */
  /* -------------------------------------------------------------- */
  let frenzy = false;
  async function theBreak() {
    busy = true;
    s.flags.broken = true;
    save();
    frenzy = true;
    for (let i = 0; i < 14; i++) setTimeout(() => spawnFloater(pick(['make it stop', 'MAKE IT STOP', 'stop', 'please', 'stop stop stop'])), i * 110);
    for (let i = 0; i < 6; i++) setTimeout(() => log(pick(['make it stop.', 'MAKE IT STOP', 'please', 'stop', "it won't stop", 'please please please']), 'voice', { instant: true }), i * 260);
    document.body.classList.add('flash');
    await sleep(2800);
    S.cut(0);
    frenzy = false;
    loudSmooth = 0.6;
    document.body.classList.remove('flash');
    ui.floaters.innerHTML = '';
    ui.toasts.innerHTML = '';
    C.open('black');
    ui.cinemaSkip.hidden = true;
    await sleep(4200);
    S.progression = 'dawn';
    S.update({ loud: 0.6, act: 4, rain: 1, heart: 0, progression: 'dawn' });
    const w = C.line("i'm still here.", 'whisper-line');
    w.style.fontSize = '20px';
    if (!s.stats.kept.includes(11)) s.stats.kept.push(11);
    await sleep(3600);
    S.unCut();
    C.line('okay.');
    await sleep(1800);
    C.line('okay.');
    ui.cinemaSkip.hidden = false;
    await C.wait(2400);
    await C.clear();
    C.line("it's 5:31 am. it's still loud in here. but you're still here.");
    await C.wait(3400);
    C.line("you can't make it stop by feeding it. you tried. you tried so hard.");
    await C.wait(3600);
    C.line('maybe you just let it go. one thing at a time.');
    await C.wait(3000);
    C.line('start with breathing.', 'warm');
    await C.wait(2600);
    startAct4();
    await C.close();
  }

  function startAct4() {
    s.act = 4;
    s.actT = 0;
    s.clock = 5 * 60 + 31;
    s.relIds = D.gens.filter(g => s.gens[g.id] > 0).map(g => g.id);
    if (!s.relIds.includes('voice')) { s.gens.voice = 1; s.relIds.push('voice'); }
    s.L0 = Math.log10(Math.max(10, s.thoughts));
    s.L = s.L0;
    s.flags.act4 = true;
    s.sel = null;
    ui.floaters.innerHTML = '';
    ui.whisperSlot.innerHTML = '';
    for (const f of ui.drift.querySelectorAll('.frag')) { f.style.transition = 'opacity 3s'; f.style.animation = 'none'; f.style.opacity = '0'; setTimeout(() => f.remove(), 3200); }
    document.title = BASE_TITLE;
    applyUI();
    log("you put a hand on your chest. it's going so fast. that's okay. it's allowed to.", 'quiet');
    if (mobileMQ.matches) setTab('mind');
    save();
  }

  /* -------------------------------------------------------------- */
  /*  breathing                                                      */
  /* -------------------------------------------------------------- */
  let breathing = null, breathLock = false, breathFullTimer = null;
  function breathDown(e) {
    if (s.act !== 4 || busy || breathLock || breathing || ui.breath.dataset.mode === 'sleep') return;
    if (e && e.preventDefault) e.preventDefault();
    breathing = { start: performance.now() };
    if (e && e.pointerId != null && ui.breath.setPointerCapture) { try { ui.breath.setPointerCapture(e.pointerId); } catch (_) { /* fine */ } }
    breathCore.style.setProperty('--bt', D.breathFull + 's');
    breathCore.style.setProperty('--b', '1');
    ui.breathText.textContent = 'in';
    S.breathIn();
    clearTimeout(breathFullTimer);
    breathFullTimer = setTimeout(() => { if (breathing) ui.breathText.textContent = 'and let go'; }, D.breathFull * 1000);
  }
  function breathUp() {
    if (!breathing) return;
    const held = (performance.now() - breathing.start) / 1000 * SPEED;
    breathing = null;
    clearTimeout(breathFullTimer);
    breathCore.style.setProperty('--bt', '3.2s');
    breathCore.style.setProperty('--b', '0.34');
    const q = E.breathQuiet(s, held);
    S.breathOut(false, held >= D.breathFull * 0.9);
    breathLock = true;
    if (q > 0) {
      s.quiet += q;
      s.stats.breaths++;
      popAt(ui.breath, '+' + fmtRate(q) + ' quiet', 'quiet');
      ui.breathText.textContent = 'out';
      if (s.stats.breaths === 1) log('in. and out. that one counted.', 'quiet');
      if (s.stats.breaths === 3) ui.breathHint.hidden = true;
    } else {
      ui.breathText.textContent = 'slower';
    }
    setTimeout(() => { breathLock = false; if (ui.breath.dataset.mode !== 'sleep') ui.breathText.textContent = 'hold'; }, (q > 0 ? 2600 : 1100) * FAST);
  }
  ui.breath.addEventListener('pointerdown', breathDown);
  ui.breath.addEventListener('pointerup', breathUp);
  ui.breath.addEventListener('pointercancel', breathUp);
  ui.breath.addEventListener('lostpointercapture', breathUp);
  ui.breath.addEventListener('contextmenu', e => e.preventDefault());
  ui.breath.addEventListener('keydown', e => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      if (ui.breath.dataset.mode === 'sleep') { ending(); return; }
      breathDown(null);
    }
  });
  ui.breath.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') breathUp(); });
  ui.breath.addEventListener('click', () => { if (ui.breath.dataset.mode === 'sleep') ending(); });

  /* -------------------------------------------------------------- */
  /*  letting go                                                     */
  /* -------------------------------------------------------------- */
  function releaseGen(id, b) {
    if (busy || s.act !== 4 || s.released.includes(id)) return;
    const g = E.gen(id);
    if (g.auto && s.released.length < s.relIds.length - 1) { shake(b); return; }
    const c = E.releaseCost(s);
    if (s.quiet < c) { shake(b); return; }
    if (g.auto) {
      if (s.flags.voiceQueued) return;
      s.flags.voiceQueued = true;
      queue.push(voiceGoodbye);
      return;
    }
    s.quiet -= c;
    fadingOut.add(id);
    b.classList.add('gone');
    s.released.push(id);
    S.release();
    log(g.releaseLine, 'quiet');
    setTimeout(() => { fadingOut.delete(id); genKey = ''; updateGens(); }, 2300);
    afterRelease();
    save();
  }

  function afterRelease() {
    const n = s.released.length;
    const total = s.relIds.length;
    if (n >= 2 && !s.flags.samStarted) queue.push(samChat);
    if (n >= Math.min(5, total - 2) && !s.flags.sixLit) {
      queue.push(async () => {
        await sleep(2500);
        s.flags.sixLit = true;
        log('a light comes on across the street. top floor. 6d.', 'window');
        hitBtns['6d'] && hitBtns['6d'].classList.add('new');
        dot('window');
      });
    }
    if (n >= Math.min(8, total - 2) && !s.flags.rainStop) {
      s.flags.rainStop = true;
      setTimeout(() => log("the rain stops. you didn't notice it was raining until it wasn't.", 'quiet'), 4000 * FAST);
    }
    if (n >= Math.min(10, total - 1) && !s.flags.birds) {
      s.flags.birds = true;
      setTimeout(() => log('the sky is doing something at the edges. not light yet. the idea of it.', 'quiet'), 6000 * FAST);
    }
    if (s.flags.waved && !s.flags.sign && n >= 7) { s.flags.sign = true; renderCaption(); dot('window'); }
  }

  async function samChat() {
    s.flags.samStarted = true;
    await sleep(3000);
    if (s.released.includes('phone')) log('your phone buzzes, face down on the table. you turn it over.');
    else log('your phone buzzes.');
    await sleep(1200);
    if (mobileMQ.matches && tab !== 'mind') dot('mind');
    const box = ui.choice;
    box.hidden = false;
    box.innerHTML = '';
    const chat = el('div', 'chat');
    const head = el('div', 'chat-head');
    head.append(el('b', null, 'sam'), document.createTextNode(fmtClock(s.clock)));
    chat.append(head);
    box.append(chat);
    S.ding();
    const them = async (text, wait) => {
      const typing = el('div', 'bubble them typing', '•••');
      chat.append(typing);
      await sleep(wait || 1400);
      typing.remove();
      chat.append(el('div', 'bubble them', text));
    };
    const you = text => chat.append(el('div', 'bubble you', text));
    const choose = opts => new Promise(res => {
      const row = el('div', 'choice-row');
      opts.forEach((o, i) => {
        const b = el('button', 'choice-btn', o);
        b.type = 'button';
        b.addEventListener('click', () => { row.remove(); you(o); res(i); });
        row.append(b);
      });
      chat.append(row);
    });
    await them("you're up late", 900);
    await them('you okay?', 1600);
    const a = await choose(['yeah im good', 'not really']);
    if (a === 1) {
      await them('ok', 1800);
      await them('want me to call?', 1600);
      const b = await choose(['yeah', "no it's ok. just. thanks"]);
      if (b === 0) {
        s.flags.sam = 'call';
        await sleep(1400);
        log('sam calls. you talk for a while. about nothing. about a show. about their ridiculous cat.', 'quiet');
        await sleep(4200);
        log('you laugh once, which surprises both of you.', 'quiet');
        await sleep(3400);
        log("'go to sleep,' sam says. 'i will,' you say. you almost mean it.", 'quiet');
      } else {
        s.flags.sam = 'truth';
        await them("ok. i'm here. always. even at 5am", 2000);
        await sleep(1200);
        log("you read it twice. you put the phone down gently, like it's something that could break.", 'quiet');
      }
    } else {
      s.flags.sam = 'fine';
      await them('ok', 1400);
      await sleep(1600);
      await them("you know you can tell me if you're not, right", 2200);
      await sleep(1000);
      log('you look at that for a long time.', 'quiet');
    }
    save();
    await sleep(7000);
    chat.style.transition = 'opacity 2s';
    chat.style.opacity = '0';
    await sleep(2000);
    box.innerHTML = '';
    box.hidden = true;
  }

  async function voiceGoodbye() {
    C.open('clear');
    await sleep(800);
    C.line("the voice is the last one. it's smaller now. it sounds younger than you expected.");
    await C.wait(3600);
    C.line("if you let me go, who's going to keep you safe?", 'voice');
    await sleep(1800);
    const a = await C.choose(['i will.', "nobody has to. not tonight."]);
    s.flags.voiceAnswer = a;
    C.line(a === 0 ? 'i will.' : "nobody has to. not tonight.", 'warm');
    await C.wait(2600);
    C.line('it thinks about that for a long time.');
    await C.wait(3000);
    C.line('okay.', 'voice');
    await C.wait(1800);
    C.line('okay. goodnight.', 'voice');
    await C.wait(2800);
    s.quiet = Math.max(0, s.quiet - E.releaseCost(s));
    s.released.push('voice');
    s.flags.voiceQueued = false;
    S.release();
    genKey = '';
    updateGens();
    await C.close();
    log('it was you the whole time. scared, and trying to help. you can both rest now.', 'quiet');
    save();
  }

  async function silence() {
    s.flags.silence = true;
    busy = true;
    await sleep(2200);
    log('silence.', 'big quiet');
    await sleep(3000);
    ui.breath.dataset.mode = 'sleep';
    ui.breathText.textContent = 'sleep';
    ui.breathHint.hidden = false;
    ui.breathHint.textContent = "whenever you're ready.";
    ui.breath.setAttribute('aria-label', 'sleep');
    breathCore.style.setProperty('--bt', '6s');
    breathCore.style.setProperty('--b', '0.6');
    busy = false;
    save();
  }

  /* -------------------------------------------------------------- */
  /*  morning                                                        */
  /* -------------------------------------------------------------- */
  function endingLine() {
    const connected = !!(s.flags.waved || s.flags.sam === 'call' || s.flags.sam === 'truth');
    const self = s.stats.kept.length >= 8;
    if (connected && self) return D.ending.both;
    if (connected) return D.ending.connected;
    if (self) return D.ending.self;
    return D.ending.neither;
  }

  async function typeInto(node, text, speed) {
    for (let i = 1; i <= text.length; i++) {
      node.textContent = text.slice(0, i);
      await sleep(speed || 70);
    }
  }
  async function eraseFrom(node, speed) {
    let t = node.textContent;
    while (t.length) {
      t = t.slice(0, -1);
      node.textContent = t;
      await sleep(speed || 60);
    }
  }

  let endingRunning = false;
  async function ending() {
    if (endingRunning) return;
    endingRunning = true;
    s.act = 5;
    s.clock = 6 * 60 + 12;
    save();
    C.open('black');
    ui.cinemaSkip.hidden = true;
    await sleep(3000);
    C.line('6:12 am', 'c-mono');
    await sleep(2400);
    ui.cinemaSkip.hidden = false;
    C.line('the sky is the color of a bruise that’s healing.');
    await C.wait(3200);
    if (s.flags.waved) { C.line("across the street, the light in 6d goes out. they're trying too."); await C.wait(3400); }
    if (s.flags.sam === 'call' || s.flags.sam === 'truth') { C.line("your phone buzzes once. sam: 'proud of you. sleep.'"); await C.wait(3400); }
    else if (s.flags.sam === 'fine') { C.line("sam's message is still there. you'll answer it properly tomorrow. you think you will."); await C.wait(3600); }
    if (s.flags.cat) { C.line('in 3c, the cat is asleep in the window. it trusts the morning.'); await C.wait(3000); }
    await C.clear();
    C.line('somewhere, someone is falling in love.');
    await C.wait(2800);
    C.line('somewhere, someone is falling asleep.');
    await C.wait(2800);
    C.line('tonight, you get to be the second one.', 'warm');
    await C.wait(4200);
    await C.clear();
    ui.cinemaSkip.hidden = true;
    C.line('anybody can find love.', 'c-big');
    await sleep(3200);
    const big = C.line('', 'c-big c-typed');
    const w1 = el('span', null, 'except');
    const w2 = el('span', null, ' you.');
    big.append(w1, w2);
    await sleep(3400);
    w1.classList.add('strike');
    await sleep(1600);
    await eraseFrom(w2, 70);
    await eraseFrom(w1, 90);
    await sleep(500);
    await typeInto(big, endingLine(), 85);
    S.finalChord();
    await sleep(5200);
    await C.clear();
    showWrapped();
  }

  function showWrapped() {
    s.act = 5;
    s.flags.endShown = true;
    save();
    if (ui.cinema.hidden) C.open('black');
    ui.cinemaSkip.hidden = true;
    ui.cinemaText.innerHTML = '';
    ui.cinemaChoices.innerHTML = '';
    const card = el('div', 'wrapped');
    card.append(el('div', 'head', 'one night'));
    const rows = [
      ['3:07 am → 6:12 am', ''],
      ['thoughts thought', fmt(s.lifetime)],
      ['times you checked your phone', fmt(Math.floor(s.stats.phone + s.stats.notifs))],
      ['windows you watched', `${D.storyWindowIds.filter(id => s.windows[id]).length} of ${D.storyWindowIds.length}`],
      ['quiet things you kept', `${s.stats.kept.length} of ${D.whispers.length}`],
      ['breaths, on purpose', fmt(s.stats.breaths)],
      ['someone asked if you were okay', s.flags.sam === 'call' ? 'yes. you let them call' : s.flags.sam === 'truth' ? 'yes. you told the truth' : s.flags.sam === 'fine' ? "yes. you said 'good'" : 'yes'],
      ['the stranger in 6d', s.flags.waved ? 'you waved' : s.flags.curtain ? 'you closed the curtain' : 'you never looked'],
    ];
    if (s.flags.cat) rows.push(['a cat slow-blinked at you', 'yes']);
    rows.push(['the last thing you let go of', 'the voice']);
    for (const [k, v] of rows) { card.append(el('span', 'k', k), el('span', 'v', v)); }
    ui.cinemaText.append(card);
    const actions = el('div', 'end-actions');
    const copy = el('button', 'choice-btn', 'copy your night');
    const stay = el('button', 'choice-btn', 'stay a while');
    const again = el('button', 'choice-btn', 'another night');
    [copy, stay, again].forEach(b => { b.type = 'button'; actions.append(b); });
    copy.addEventListener('click', async ev => {
      ev.stopPropagation();
      const text = `i thought ${fmt(s.lifetime)} thoughts last night. then i let every one of them go. anybody can find love. ${endingLine()} — except you.`;
      try { await navigator.clipboard.writeText(text); copy.textContent = 'copied'; }
      catch (e) {
        const p = el('p', 'end-note on', text);
        p.style.userSelect = 'all';
        actions.after(p);
        copy.textContent = 'select it below';
      }
    });
    stay.addEventListener('click', ev => { ev.stopPropagation(); stayAWhile(); });
    again.addEventListener('click', ev => { ev.stopPropagation(); anotherNight(); });
    ui.cinemaText.append(actions);
    const note = el('p', 'end-note', 'if your nights get this loud, tell someone. a friend, a doctor, a helpline. you’re allowed to.');
    ui.cinemaText.append(note);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      card.classList.add('on');
      setTimeout(() => actions.classList.add('on'), 1600 * FAST);
      setTimeout(() => note.classList.add('on'), 3200 * FAST);
    }));
  }

  async function stayAWhile() {
    s.flags.stayed = true;
    ui.mainBtn.hidden = true;
    ui.breath.hidden = true;
    ui.breathHint.hidden = true;
    ui.choice.hidden = false;
    ui.choice.innerHTML = '';
    const again = el('button', 'choice-btn', 'see your night again');
    again.type = 'button';
    again.addEventListener('click', () => { C.open('black'); showWrapped(); });
    ui.choice.append(el('p', 'cap-text', 'goodnight.'), again);
    await C.close();
    save();
  }

  function anotherNight() {
    s = null;
    hotSave = null;
    store.del();
    location.reload();
  }

  /* -------------------------------------------------------------- */
  /*  the passing of time                                            */
  /* -------------------------------------------------------------- */
  function loudTarget() {
    switch (s.act) {
      case 1: return 0.04 + 0.1 * Math.min(1, s.lifetime / 6500);
      case 2: return 0.14 + 0.22 * E.stagesTotal(s) / 36;
      case 3:
        if (frenzy) return 1;
        if (s.flags.broken) return 0.6;
        return Math.min(1, 0.42 + s.actT / 330 + (s.upgrades.stop1 ? 0.08 : 0) + (s.upgrades.stop2 ? 0.1 : 0));
      case 4: return s.flags.silence ? 0 : 0.7 * (1 - s.released.length / Math.max(1, s.relIds.length));
      default: return 0;
    }
  }

  function tick(dt) {
    s.t += dt;
    s.actT += dt;

    // the clock, which sticks when you stall
    const cap = D.clock.caps[s.act] || D.clock.caps[1];
    const before = Math.floor(s.clock);
    s.clock = Math.min(cap, s.clock + dt / D.clock.secondsPerMinute);
    const now = Math.floor(s.clock);
    if (now !== before) {
      const line = D.clock.lines[now];
      if (line && !s.flags.clk[now]) {
        const okAct = (now < 4 * 60 + 44 && s.act <= 2) || (now === 5 * 60 && s.act === 3) || (now >= 5 * 60 + 31 && s.act === 4);
        if (okAct) { s.flags.clk[now] = 1; log(line, 'sys'); }
      }
    }
    ui.clock.classList.toggle('stuck', s.clock >= cap && s.act < 5);

    if (s.act >= 1 && s.act <= 3) {
      const p = E.production(s);
      s.thoughts += p * dt;
      s.lifetime += p * dt;
      s.stats.phone += (s.gens.phone || 0) * dt / 9;
    }

    // act 1 beats
    if (!s.flags.counter && s.lifetime >= 3) {
      s.flags.counter = true;
      applyUI();
      log("you start counting them. it doesn't help.");
    }
    if (!s.flags.habits && s.lifetime >= 8) {
      s.flags.habits = true;
      applyUI();
      log('you know what you do on nights like this. you have a whole routine.');
      dot('habits');
    }
    if (s.act === 1 && s.flags.habits && s.t - s.lastThoughtT > 30 && s.thoughtIdx >= D.firstThoughts.length) {
      s.lastThoughtT = s.t;
      log(fresh(D.moreThoughts));
    }

    // act 2: the building wakes up
    if (s.act === 2) {
      s.longing += E.longingRate(s) * dt;
      if (visible('window')) s.stats.watchT += dt;
      s.timers.light -= dt;
      if (s.timers.light <= 0 && s.lit < D.lightOrder.length) {
        s.timers.light = D.lightInterval;
        const id = D.lightOrder[s.lit++];
        hitBtns[id] && hitBtns[id].classList.add('new');
        dot('window');
      }
    }

    // act 3: the voice grows on its own
    if (s.act === 3 && !s.flags.broken) {
      s.timers.voice -= dt;
      if (s.timers.voice <= 0) { s.timers.voice = 6; s.gens.voice++; }
      s.timers.voiceLine -= dt;
      if (s.timers.voiceLine <= 0) { s.timers.voiceLine = rand(13, 22) * (1 - V.loud * 0.35); voiceLine(); }
      s.timers.floater -= dt;
      if (s.timers.floater <= 0) { s.timers.floater = rand(4, 9) * (1.2 - V.loud * 0.6); spawnFloater(); }
      s.timers.dark -= dt;
      if (s.timers.dark <= 0) {
        s.timers.dark = rand(26, 36);
        const candidates = D.storyWindowIds.filter(id => !s.gone.includes(id));
        if (candidates.length > 2) {
          const id = pick(candidates);
          s.gone.push(id);
          log(pick([`${id} goes dark. they're asleep now. together.`, `the light in ${id} goes out. two people, one bed.`, `${id} turns their light off. they don't need it. they have each other.`]), 'voice');
        }
      }
      s.timers.glitch -= dt;
      if (s.timers.glitch <= 0) {
        s.timers.glitch = rand(3, 8) * (1.2 - V.loud);
        const ids = Object.keys(genRows);
        s.glitchId = ids.length ? pick(ids) : null;
        setTimeout(() => { s.glitchId = null; }, 1600);
      }
      if (!s.flags.flickered && s.actT > 95) {
        s.flags.flickered = true;
        s.flags.flickerOn = true;
        setTimeout(() => { s.flags.flickerOn = false; }, 1400);
        log('for a second, a light on the top floor. 6d. then nothing.', 'sys');
      }
      mainLabel();
      if (Math.random() < dt * 0.15 && !document.hidden) document.title = pick(['are you still awake', 'except you.', 'why are you like this', BASE_TITLE]);
    }

    // act 4: quiet
    if (s.act === 4) {
      s.quiet += E.quietRate(s) * dt;
      const total = Math.max(1, s.relIds.length);
      const frac = s.released.length / total;
      const target = s.released.length >= total ? -0.6 : s.L0 * (1 - frac) * (1 - 0.15 * Math.min(1, s.actT / 400));
      s.L += (target - s.L) * Math.min(1, dt * 0.45);
      s.thoughts = s.L <= 0 ? 0 : Math.pow(10, s.L);
      if (s.released.length >= total && s.thoughts === 0 && !s.flags.silence && !busy) silence();
    }

    // the phone (acts 1–3)
    if (s.act >= 1 && s.act <= 3 && s.gens.phone > 0) {
      s.timers.notif -= dt;
      if (s.timers.notif <= 0) {
        s.timers.notif = (s.act === 3 ? rand(24, 38) : rand(55, 95)) * (s.upgrades.notifs ? 0.6 : 1);
        if (!busy) spawnNotif();
      }
    }
    // the quiet voice (acts 1–3)
    if (s.act >= 1 && s.act <= 3 && s.flags.counter) {
      s.timers.whisper -= dt;
      if (s.timers.whisper <= 0) {
        if (busy || !visible('mind')) s.timers.whisper = 5;
        else { s.timers.whisper = s.act === 3 ? rand(45, 70) : rand(70, 105); spawnWhisper(); }
      }
    }
    // drifting fragments
    s.timers.drift -= dt;
    if (s.timers.drift <= 0 && !reduced) {
      if (s.act === 3 && !s.flags.broken) { s.timers.drift = rand(1.4, 3.2) * (1.4 - V.loud * 0.8); V.drift(ui.drift, pick(D.loudFragments.concat(D.fragments)), { loud: Math.random() < V.loud, alpha: rand(0.07, 0.16 + V.loud * 0.16) }); }
      else if (s.act === 4) {
        s.timers.drift = rand(9, 16);
        if (s.stats.kept.length) {
          const f = V.drift(ui.drift, D.whispers[pick(s.stats.kept)], { alpha: 0.16, size: 17 });
          f.style.color = 'var(--whisper)';
        }
      } else if (s.act >= 1 && s.act <= 2) {
        s.timers.drift = rand(3, 7) / (1 + s.act * 0.4);
        V.drift(ui.drift, pick(D.fragments));
      } else s.timers.drift = 10;
    }

    // whatever is waiting
    if (!busy && queue.length) {
      const fn = queue.shift();
      Promise.resolve(fn()).catch(err => { console.error(err); busy = false; });
    }
  }

  let loudSmooth = 0;
  let uiTimer = 0, audioTimer = 0, saveTimer = 0;
  function render(dt, t) {
    // loudness
    const lt = s && s.act ? loudTarget() : 0.04;
    loudSmooth += (lt - loudSmooth) * Math.min(1, dt * 0.8);
    V.loud = loudSmooth;
    document.body.style.setProperty('--loud', (s && s.act === 3 ? loudSmooth : loudSmooth * 0.3).toFixed(3));
    document.body.classList.toggle('shake', !reduced && (frenzy || !!(s && s.act === 3 && !s.flags.broken && loudSmooth > 0.84)));
    V.phoneGlow = Math.max(s && s.gens && s.gens.phone > 0 && s.act < 4 ? 0.35 : 0, V.phoneGlow - dt * 0.4);
    if (s) {
      const wantRain = s.act >= 4 && s.flags.rainStop ? 0 : 1;
      V.rainLevel += (wantRain - V.rainLevel) * Math.min(1, dt * 0.25);
      const wantDawn = s.act >= 5 ? 1 : s.act === 4 ? 0.15 + 0.75 * s.released.length / Math.max(1, s.relIds.length) : 0;
      V.dawn += (wantDawn - V.dawn) * Math.min(1, dt * 0.3);
      document.body.style.setProperty('--dawn-amt', V.dawn.toFixed(3));
    }
    V.drawBackground(dt);
    if (cinemaScene && !ui.cinema.hidden) drawCinema(t);

    if (!s || !s.act) return;

    if (!ui.panelWindow.hidden && visible('window')) {
      V.drawBuilding(ui.building, { windows: windowState(t), t, selected: s.sel, loud: s.act === 3 ? loudSmooth : 0, dawn: V.dawn * 0.8 });
    }

    uiTimer -= dt;
    if (uiTimer <= 0) {
      uiTimer = 0.1;
      ui.clock.textContent = fmtClock(s.clock);
      const loud = s.act === 3 && loudSmooth > 0.7 && Math.random() < 0.06;
      ui.count.textContent = loud ? pick(['too many', 'so many', 'all of them', fmt(s.thoughts)]) : fmt(s.thoughts);
      if (s.act <= 3) {
        const p = E.production(s);
        ui.rate.textContent = p > 0 ? `+${fmtRate(p)} / sec` : '';
        ui.countLabel.textContent = 'thoughts';
      } else {
        ui.countLabel.textContent = s.thoughts > 0 ? 'thoughts, and falling' : 'thoughts';
        ui.rate.textContent = '';
      }
      ui.longingCount.textContent = `longing ${fmt(s.longing)} · +${fmtRate(E.longingRate(s))}/s`;
      ui.quietCount.textContent = `quiet ${fmt(s.quiet)}${s.released.length ? ` · +${fmtRate(E.quietRate(s))}/s` : ''}`;
      ui.mini.textContent = s.act >= 4 ? `quiet ${fmt(s.quiet)}` : s.act === 2 ? `${fmt(s.thoughts)} · longing ${fmt(s.longing)}` : `${fmt(s.thoughts)} thoughts`;
      if (s.act === 2) {
        const watched = D.storyWindowIds.filter(id => s.windows[id]).length;
        ui.windowMeta.textContent = `watched ${watched} of ${D.storyWindowIds.length} · ${E.stagesTotal(s)} / 36 moments`;
      } else if (s.act === 3) ui.windowMeta.textContent = `${D.storyWindowIds.filter(id => !s.gone.includes(id)).length} still lit`;
      else ui.windowMeta.textContent = '';
      updateGens();
      updateUpgrades();
      refreshCaptionButton();
      if (s.act === 1 && s.flags.habits && !visible('habits')) {
        const affordable = D.gens.some(g => genVisible(g) && !g.auto && s.thoughts >= E.genCost(g, s.gens[g.id]));
        if (affordable) dot('habits');
      }
    }

    audioTimer -= dt;
    if (audioTimer <= 0) {
      audioTimer = 0.25;
      const broken = s.act === 3 && s.flags.broken && !frenzy;
      if (broken) {
        S.update({ loud: 0.6, act: 4, rain: 1, heart: 64, heartVol: 0.25, birds: false, progression: 'dawn' });
      } else S.update({
        loud: loudSmooth,
        act: s.act,
        rain: s.act >= 4 && s.flags.rainStop ? 0 : 1,
        heart: s.act === 3 ? 62 + loudSmooth * 58 : s.act === 4 && !s.flags.silence ? 52 + 30 * loudSmooth : 0,
        heartVol: s.act === 3 ? 0.4 + loudSmooth * 0.6 : 0.4 * loudSmooth,
        birds: s.act >= 4 && s.flags.birds,
        birdVol: s.act >= 5 ? 0.5 : 1,
        progression: s.act >= 4 ? 'dawn' : s.act === 3 ? 'loud' : 'night',
      });
    }

    saveTimer -= dt;
    if (saveTimer <= 0) { saveTimer = 5; if (running) save(); }
  }

  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.5) dt = 0.5;
    if (running && s && s.act >= 1 && s.act <= 4) {
      const steps = SPEED > 1 ? 4 : 1;
      for (let i = 0; i < steps; i++) tick(dt * SPEED / steps);
    }
    render(dt, now / 1000);
    requestAnimationFrame(frame);
  }

  /* away from the screen */
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (!s || !s.act) return;
    if (document.hidden) {
      hiddenAt = Date.now();
      save();
      if (s.act === 2 || s.act === 3) document.title = '(1) new message';
      else if (s.act === 4) document.title = "it's okay to rest";
    } else {
      document.title = BASE_TITLE;
      const away = (Date.now() - hiddenAt) / 1000;
      hiddenAt = 0;
      catchUp(away, true);
    }
  });

  function catchUp(away, fromHidden) {
    if (!running || !s || away < 2) return;
    if (s.act === 1 || s.act === 2) {
      const sec = Math.min(away, 900);
      const p = E.production(s) * sec;
      s.thoughts += p; s.lifetime += p;
      if (s.act === 2) s.longing += E.longingRate(s) * sec;
      s.clock = Math.min(D.clock.caps[s.act], s.clock + sec / D.clock.secondsPerMinute);
      if (sec > 20 && p > 0) log(`you zoned out for a while. ${fmt(p)} thoughts went by anyway.`, 'sys');
      if (fromHidden && s.act === 2 && sec > 6 && !s.flags.fakeMsg) {
        s.flags.fakeMsg = true;
        log("there was no new message. there's never a new message.", 'voice');
      }
    } else if (s.act === 3 && fromHidden && away > 6 && !s.flags.fakeMsg3) {
      s.flags.fakeMsg3 = true;
      log('you looked away. it kept going without you. it always does.', 'voice');
    }
  }

  /* -------------------------------------------------------------- */
  /*  sound + menu                                                   */
  /* -------------------------------------------------------------- */
  let muted = false;
  function setMuted(m) {
    muted = m;
    S.setMuted(m);
    ui.btnSound.textContent = m ? 'sound off' : 'sound on';
    ui.btnSound.setAttribute('aria-pressed', String(!m));
    ui.mSound.textContent = 'sound: ' + (m ? 'off' : 'on');
    try { localStorage.setItem(SAVE_KEY + '.muted', m ? '1' : ''); } catch (e) { /* fine */ }
  }
  ui.btnSound.addEventListener('click', () => { S.init(); setMuted(!muted); });
  ui.mSound.addEventListener('click', () => { S.init(); setMuted(!muted); });
  function setReduced(r) {
    reduced = r;
    V.reduced = r;
    document.body.classList.toggle('reduced', r);
    ui.mMotion.textContent = 'fewer effects: ' + (r ? 'on' : 'off');
    try { localStorage.setItem(SAVE_KEY + '.reduced', r ? '1' : ''); } catch (e) { /* fine */ }
  }
  ui.mMotion.addEventListener('click', () => setReduced(!reduced));
  ui.btnMenu.addEventListener('click', e => {
    e.stopPropagation();
    const open = ui.menu.hidden;
    ui.menu.hidden = !open;
    ui.mConfirm.hidden = true;
    ui.btnMenu.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', e => {
    if (!ui.menu.hidden && !ui.menu.contains(e.target) && e.target !== ui.btnMenu) {
      ui.menu.hidden = true;
      ui.btnMenu.setAttribute('aria-expanded', 'false');
    }
  });
  ui.mReset.addEventListener('click', () => { ui.mConfirm.hidden = false; });
  ui.mResetNo.addEventListener('click', () => { ui.mConfirm.hidden = true; });
  ui.mResetYes.addEventListener('click', anotherNight);

  /* -------------------------------------------------------------- */
  /*  beginning                                                      */
  /* -------------------------------------------------------------- */
  async function begin() {
    S.init();
    ui.title.classList.add('out');
    s = newState();
    s.act = 1;
    store.del();
    await sleep(1200);
    ui.title.hidden = true;
    C.open('black');
    await sleep(1400);
    C.line("it's 3:07 am.");
    await C.wait(2400);
    C.line("you can't sleep.");
    await C.wait(2400);
    C.line("you've been lying here for a while now, and your head won't stop.", 'dim');
    await C.wait(3200);
    ui.app.hidden = false;
    applyUI();
    renderLog();
    ui.mainBtn.classList.add('pulse');
    running = true;
    last = performance.now();
    await C.close();
    ui.mainBtn.focus({ preventScroll: true });
    save();
  }

  async function resume(saved) {
    S.init();
    ui.title.classList.add('out');
    s = saved;
    const away = (Date.now() - (s.savedAt || Date.now())) / 1000;
    await sleep(1000);
    ui.title.hidden = true;
    ui.app.hidden = false;
    renderLog();
    applyUI();
    positionHits();
    running = true;
    last = performance.now();

    // pick the story back up wherever it was left
    if (s.act === 5) { if (s.flags.endShown) showWrapped(); else ending(); return; }
    if (s.act === 2 && E.stagesTotal(s) >= 36 && !s.flags.act3) { s.flags.exceptQueued = true; queue.push(exceptYou); }
    else if (s.act === 3 && s.flags.broken && !s.flags.act4) { theBreak(); }
    else if (s.act === 4) {
      if (s.flags.samStarted && !s.flags.sam) { s.flags.samStarted = false; queue.push(samChat); }
      if (s.relIds.length && s.released.length === s.relIds.length - 1 && s.relIds.every(id => id === 'voice' || s.released.includes(id))) { /* waiting on the voice, nothing to do */ }
      if (s.flags.silence && s.released.length >= s.relIds.length) { s.flags.silence = false; }
    } else {
      catchUp(away, false);
    }
    log(s.act >= 4 ? 'you come back to the room. it is quieter than you left it.' : "you come back to it. it's still " + fmtClock(s.clock) + '.', 'sys');
    save();
  }

  function showTitle() {
    const saved = parseSave(hotSave) || parseSave(store.get());
    ui.tBegin.hidden = !!saved;
    ui.tContinue.hidden = !saved;
    ui.tNew.hidden = !saved;
    ui.tBegin.addEventListener('click', begin, { once: true });
    ui.tContinue.addEventListener('click', () => resume(saved), { once: true });
    ui.tNew.addEventListener('click', () => { ui.tConfirm.hidden = false; ui.tNew.hidden = true; });
    ui.tNewNo.addEventListener('click', () => { ui.tConfirm.hidden = true; ui.tNew.hidden = false; });
    ui.tNewYes.addEventListener('click', () => { ui.tConfirm.hidden = true; begin(); }, { once: true });
    (saved ? ui.tContinue : ui.tBegin).focus({ preventScroll: true });
  }

  function start(data) {
    if (data && data.save) hotSave = data.save;
    try {
      if (localStorage.getItem(SAVE_KEY + '.muted')) setMuted(true);
      if (localStorage.getItem(SAVE_KEY + '.reduced')) setReduced(true);
    } catch (e) { /* defaults */ }
    if (reducedMQ.matches) setReduced(true);
    V.initBackground(ui.bg);
    buildHits();
    s = null;
    showTitle();
    requestAnimationFrame(frame);
    if (qs.has('debug')) window.__night = { get s() { return s; }, E, D, C, tick, applyUI, startAct4, theBreak, exceptYou, ending, setTab };
  }

  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => ({ save: s && s.act ? JSON.stringify(s) : null }));
  if (hot && hot.ready) hot.ready(start);
  else start((hot && hot.data) || {});
})();
