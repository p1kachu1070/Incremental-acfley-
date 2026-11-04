#!/usr/bin/env node
/* Renders the link-preview image (assets/og.png, 1200x630) from the game's own drawing code.
   usage: node tools/og.js */
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const page = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono&family=Instrument+Serif:ital@0;1&display=swap">
<style>
  html,body{margin:0;width:1200px;height:630px;background:#07080d;overflow:hidden}
  canvas{position:absolute;inset:0;width:1200px;height:630px;opacity:.5}
  .shade{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(3,3,6,.86) 0%,rgba(3,3,6,.55) 45%,rgba(3,3,6,.2) 80%)}
  .t{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
     font-family:"Instrument Serif",Georgia,serif;font-style:italic;color:#ddd6c8;text-align:center;text-shadow:0 0 30px #000}
  .a{font-size:62px;line-height:1.05}
  .b{font-size:112px;line-height:1}
  .b span{color:#f2c27b}
  .c{margin-top:22px;font-family:"DM Mono",monospace;font-style:normal;font-size:19px;letter-spacing:.16em;color:#8a8ea0}
</style></head><body>
<canvas id="c"></canvas><div class="shade"></div>
<div class="t"><div class="a">anybody can find love.</div><div class="b">except you<span>.</span></div><div class="c">an incremental game about 3 am</div></div>
</body></html>`;
(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.setContent(page, { waitUntil: 'networkidle' });
  await p.addScriptTag({ path: path.join(root, 'js', 'data.js') });
  await p.addScriptTag({ path: path.join(root, 'js', 'visuals.js') });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => {
    const wins = {};
    for (const w of DATA.windows) wins[w.id] = { lit: !!(w.lines || w.pose === 'cat' || w.pose === 'lamp'), stage: 3 };
    Visuals.drawBuilding(document.getElementById('c'), { windows: wins, t: 2, allLit: true, labels: false, reflection: 1, loud: 0 });
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(root, 'assets', 'og.png') });
  await browser.close();
  console.log('wrote assets/og.png');
})();
