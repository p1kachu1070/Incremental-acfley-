#!/usr/bin/env node
/* Renders clip.html to a vertical 1080x1920 MP4 with the game's own audio, ready for TikTok/Reels/Shorts.
   Needs ffmpeg on PATH.   usage: node tools/clip-render.js [out.mp4] */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'dist', 'except-you-clip.mp4'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'except-you-clip-'));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(root, 'clip.html') + '?render');
  await page.evaluate(() => Clip.ready());
  const { FPS, DURATION, LEAD } = await page.evaluate(() => ({ FPS: Clip.FPS, DURATION: Clip.DURATION, LEAD: Sound.CLIP_LEAD }));

  console.log('rendering audio…');
  const wav = path.join(tmp, 'audio.wav');
  fs.writeFileSync(wav, Buffer.from(await page.evaluate(() => window.__clip.audio()), 'base64'));
  // a fresh page for frames, so the offline audio graph is out of the way
  await page.reload();
  await page.evaluate(() => Clip.ready());

  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-ss', String(LEAD), '-i', wav,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-af', 'volume=4dB,alimiter=limit=0.891:level=0',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
    '-t', String(DURATION), '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));

  const frames = Math.round(DURATION * FPS);
  for (let i = 0; i < frames; i++) {
    const url = await page.evaluate(t => window.__clip.frame(t), i / FPS);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 60 === 0) process.stdout.write(`frames ${i}/${frames}\r`);
  }
  ff.stdin.end();
  await done;
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  if (errors.length) { console.error('page errors:\n' + errors.join('\n')); process.exit(1); }
  console.log(`\nwrote ${out}`);
})().catch(e => { console.error(e); process.exit(1); });
