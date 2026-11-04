#!/usr/bin/env node
/* Simulates a reasonably attentive player through acts 1–4 and prints pacing.
   usage: node tools/sim.js [clicksPerSecond] */
'use strict';
require('../js/data.js');
const { DATA, E } = globalThis;

const CPS = Number(process.argv[2] || 3);
const DT = 0.25;

const s = {
  act: 1, actT: 0, thoughts: 0, lifetime: 0, longing: 0,
  gens: Object.fromEntries(DATA.gens.map(g => [g.id, 0])),
  upgrades: {}, windows: {}, lit: 3, released: [],
  flags: {}, stats: { kept: [] },
};
let t = 0;
const marks = [];
const mark = label => marks.push([t, label]);
const fmt = n => n >= 1e6 ? n.toExponential(2) : n.toFixed(0);
const mmss = x => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;

let nextNotif = 60, nextLight = 25, nextVoice = 6, nextFloater = 8;

function candidates() {
  const out = [];
  for (const g of DATA.gens) {
    if (g.auto || g.act > s.act) continue;
    const c = E.genCost(g, s.gens[g.id]);
    if (c <= s.thoughts) out.push({ kind: 'gen', g, c, gain: E.genRate(s, g) });
  }
  for (const u of DATA.upgrades) {
    if (s.upgrades[u.id] || u.act > s.act || !u.req(s) || u.cost > s.thoughts) continue;
    if (u.story) { out.push({ kind: 'story', u, c: u.cost, gain: Infinity }); continue; }
    const before = E.production(s);
    s.upgrades[u.id] = true;
    const after = E.production(s);
    delete s.upgrades[u.id];
    out.push({ kind: 'up', u, c: u.cost, gain: Math.max(after - before, 1e-9) + (u.click ? 1 : 0) });
  }
  return out;
}

function buy() {
  for (let guard = 0; guard < 50; guard++) {
    const c = candidates();
    if (!c.length) return;
    c.sort((a, b) => a.c / a.gain - b.c / b.gain);
    const best = c[0];
    // a player saves up a bit for the story button rather than ignoring it
    s.thoughts -= best.c;
    if (best.kind === 'gen') s.gens[best.g.id]++;
    else {
      s.upgrades[best.u.id] = true;
      if (best.u.voices) s.gens.voice += best.u.voices;
      if (best.u.id === 'curtains') { s.act = 2; s.actT = 0; mark('act 2 (curtains)'); }
      if (best.u.id === 'stop1') mark('make it stop');
      if (best.u.id === 'stop2') mark('make it stop.');
      if (best.u.id === 'stop3') { s.act = 4; s.actT = 0; mark('act 4 (MAKE IT STOP)'); return; }
    }
  }
}

function windowsAct2() {
  const lit = DATA.lightOrder.slice(0, s.lit).filter(id => DATA.storyWindowIds.includes(id));
  for (const id of lit) if (!s.windows[id]) s.windows[id] = 1;
  for (let guard = 0; guard < 40; guard++) {
    let best = null;
    for (const id of lit) {
      const st = s.windows[id];
      if (st >= 3) continue;
      const c = E.stageCost(s, st + 1);
      if (!best || c < best.c) best = { id, c };
    }
    if (!best || best.c > s.longing) return;
    s.longing -= best.c;
    s.windows[best.id]++;
  }
}

let act2Done = false;
while (t < 3600) {
  t += DT; s.actT += DT;
  const p = E.production(s);
  const clickGain = E.clickValue(s) * CPS * DT;
  s.thoughts += p * DT + clickGain;
  s.lifetime += p * DT + clickGain;
  if (s.act === 2) {
    s.longing += E.longingRate(s) * DT;
    nextLight -= DT;
    if (nextLight <= 0 && s.lit < DATA.lightOrder.length) { s.lit++; nextLight = DATA.lightInterval; }
    windowsAct2();
    if (!act2Done && E.stagesTotal(s) >= 36) {
      act2Done = true; mark('act 3 (except you.)');
      s.act = 3; s.actT = 0; s.gens.voice = 1;
    }
  }
  if (s.act >= 1 && s.act <= 3 && s.gens.phone > 0) {
    nextNotif -= DT;
    if (nextNotif <= 0) {
      nextNotif = s.upgrades.notifs ? 40 : 70;
      s.thoughts += Math.max(25, p * 45);
      if (s.act === 2) s.longing += 10 + E.longingRate(s) * 10;
    }
  }
  if (s.act === 3) {
    nextVoice -= DT;
    if (nextVoice <= 0) { nextVoice = 6; s.gens.voice++; }
    nextFloater -= DT;
    if (nextFloater <= 0) { nextFloater = 8; s.thoughts += p * 4; }
  }
  if (s.act === 4) break;
  buy();
  if (Math.abs(t % 60) < DT / 2) {
    console.log(`${mmss(t)}  act ${s.act}  thoughts ${fmt(s.thoughts).padStart(9)}  /s ${fmt(p).padStart(9)}  ` +
      `longing ${fmt(s.longing).padStart(6)}  stages ${E.stagesTotal(s)}  voice ${s.gens.voice}  ` +
      DATA.gens.filter(g => s.gens[g.id]).map(g => `${g.id}:${s.gens[g.id]}`).join(' '));
  }
}
const act4Start = t;

/* act 4: a player who breathes slowly and lets go whenever they can */
const owned = DATA.gens.filter(g => s.gens[g.id] > 0).map(g => g.id);
s.stats.kept = Array(7).fill('x');
let quiet = 0, breathT = 0, at = 0;
while (s.released.length < owned.length && at < 1800) {
  at += DT; breathT += DT;
  if (breathT >= 5.5) { breathT = 0; quiet += E.breathQuiet(s, 4.1); }
  quiet += E.quietRate(s) * DT;
  const c = E.releaseCost(s);
  if (quiet >= c) {
    quiet -= c;
    s.released.push(owned.find(id => !s.released.includes(id) && (id !== 'voice' || s.released.length === owned.length - 1)));
    if (s.released.length === 2) s.flags.sam = 'truth';
    if (s.released.length === 5) s.flags.waved = true;
  }
}
t += at + 40; // dialogues + the drain to zero
mark('act 4 done (silence)');

console.log('\nmilestones');
for (const [time, label] of marks) console.log(`  ${mmss(time).padStart(6)}  ${label}`);
console.log(`  act 4 took ${mmss(at)} for ${owned.length} releases`);
console.log(`  peak thoughts ${s.lifetime.toExponential(2)}`);
