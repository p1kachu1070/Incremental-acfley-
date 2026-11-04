#!/usr/bin/env node
/* Plays the whole night in a headless browser through the real UI, fast.
   usage: node tools/playtest.js [outDir] [--mobile]
   Takes screenshots at each act and fails on any console error. */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium, devices } = require('playwright');

const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..', '.playtest');
const mobile = process.argv.includes('--mobile');
fs.mkdirSync(out, { recursive: true });
const url = 'file://' + path.join(__dirname, '..', 'index.html') + '?speed=24&fast&debug';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForTimeout(800);
  const shot = async name => {
    await page.screenshot({ path: path.join(out, `${mobile ? 'm' : 'd'}-${name}.png`) });
    console.log('  shot', name);
  };
  await shot('0-title');
  await page.click('#t-begin');
  await page.waitForFunction(() => !document.getElementById('app').hidden, null, { timeout: 20000 });
  await page.waitForFunction(() => document.getElementById('cinema').hidden, null, { timeout: 20000 });

  // an autoplayer that lives in the page and uses the real buttons
  await page.evaluate(isMobile => {
    const $ = s => document.querySelector(s);
    const N = window.__night;
    const tab = name => { const b = document.querySelector(`.tab[data-tab="${name}"]`); if (isMobile && b && !b.hidden) b.click(); };
    let phase = 0;
    window.__auto = setInterval(() => {
      const s = N.s;
      if (!s || !document.getElementById('cinema').hidden) return;
      phase++;
      if (s.act >= 1 && s.act <= 3) {
        if (isMobile) tab('mind');
        for (let i = 0; i < 6; i++) $('#main-btn').click();
        document.querySelectorAll('.whisper:not(.kept)').forEach(w => { if (Math.random() < 0.8) w.click(); });
        document.querySelectorAll('.toast').forEach(t => t.click());
        document.querySelectorAll('.floater').forEach(f => { if (Math.random() < 0.3) f.click(); });
        if (isMobile) tab('habits');
        const ups = [...document.querySelectorAll('.up.can')];
        if (ups.length) ups[0].click();
        const gens = [...document.querySelectorAll('.gen:not(.poor):not(.voice)')];
        if (gens.length) gens[gens.length - 1].click();
      }
      if (s.act === 2) {
        tab('window');
        for (const id of N.D.storyWindowIds) {
          const b = document.querySelector(`.win-hit[aria-label="window ${id}"]`);
          if (!b) continue;
          b.click();
          const k = $('.cap-btn[aria-disabled="false"]');
          if (k) k.click();
        }
        const cat = document.querySelector('.win-hit[aria-label="window 3c"]');
        if (cat) cat.click();
      }
      if (s.act === 4) {
        const chatBtns = [...document.querySelectorAll('.chat .choice-btn')];
        if (chatBtns.length) chatBtns[chatBtns.length - 1].click();
        if (s.flags.sixLit) {
          tab('window');
          document.querySelector('.win-hit[aria-label="window 6d"]').click();
          const caps = [...document.querySelectorAll('.cap-btn')];
          const wave = caps.find(b => b.textContent === 'wave' || b.textContent === 'nod');
          if (wave) wave.click();
        }
        if (isMobile) tab('habits');
        const rel = [...document.querySelectorAll('.gen.release:not(.poor):not(.locked):not(.gone)')];
        if (rel.length) rel[0].click();
        if (isMobile) tab('mind');
        const br = $('#breath');
        if (br && !br.hidden && br.dataset.mode !== 'sleep' && !window.__holding) {
          window.__holding = true;
          br.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
          setTimeout(() => { br.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 })); setTimeout(() => { window.__holding = false; }, 200); }, 260);
        }
        if (br && br.dataset.mode === 'sleep') br.click();
      }
    }, 120);
  }, mobile);

  const waitAct = async (pred, label, timeout) => {
    const t0 = Date.now();
    await page.waitForFunction(pred, null, { timeout: timeout || 240000, polling: 250 });
    console.log(`  ${label} after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  };
  // the cinema auto-advances, but taps help it along
  const tapper = setInterval(() => page.evaluate(() => {
    const c = document.getElementById('cinema');
    if (c.hidden) return;
    const choice = c.querySelector('.cinema-choices button');
    if (choice) choice.click(); else c.click();
  }).catch(() => {}), 400);

  await page.waitForTimeout(4000);
  await shot('1-act1-early');
  await waitAct(() => window.__night.s.flags.habits && window.__night.s.gens.phone >= 3, 'act 1 habits');
  await shot('1-act1-habits');
  await waitAct(() => window.__night.s.act === 2 && document.getElementById('cinema').hidden, 'act 2');
  await page.waitForTimeout(6000);
  await shot('2-act2');
  await waitAct(() => window.__night.s.flags.exceptQueued && !document.getElementById('cinema').hidden && document.querySelectorAll('.c-big').length >= 2, 'except you');
  await page.waitForTimeout(400);
  await shot('2-except-you');
  await waitAct(() => window.__night.s.act === 3 && document.getElementById('cinema').hidden, 'act 3');
  await page.waitForTimeout(9000);
  await shot('3-act3');
  await waitAct(() => window.__night.s.upgrades.stop2, 'make it stop.');
  await shot('3-act3-late');
  await waitAct(() => window.__night.s.act === 4 && document.getElementById('cinema').hidden, 'act 4');
  await page.waitForTimeout(1500);
  await shot('4-act4');
  await waitAct(() => window.__night.s.flags.sam, 'sam');
  await waitAct(() => window.__night.s.flags.waved, 'waved');
  await page.waitForTimeout(1000);
  await shot('4-wave');
  await waitAct(() => window.__night.s.flags.voiceAnswer != null, 'voice answered');
  await waitAct(() => window.__night.s.act === 5, 'sleep');
  await waitAct(() => document.querySelector('.wrapped.on'), 'wrapped');
  await page.waitForTimeout(1500);
  await shot('5-wrapped');
  clearInterval(tapper);
  await page.evaluate(() => clearInterval(window.__auto));
  await page.click('.end-actions .choice-btn:nth-child(2)');
  await page.waitForTimeout(2500);
  await shot('5-stay');

  const summary = await page.evaluate(() => {
    const s = window.__night.s;
    return { act: s.act, lifetime: s.lifetime, kept: s.stats.kept.length, sam: s.flags.sam, waved: s.flags.waved, cat: s.flags.cat, released: s.released.length, relIds: s.relIds.length };
  });
  console.log('  summary', JSON.stringify(summary));
  await browser.close();
  if (errors.length) {
    console.log('ERRORS:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log('no errors');
})().catch(e => { console.error(e); process.exit(1); });
