#!/usr/bin/env node
/* Bundles the game into one self-contained HTML file (CSS and JS inlined).
   usage: node tools/build.js [out.html] [--fragment]
   --fragment leaves out <!doctype>/<html>/<head>/<body>, for hosts that wrap the page themselves. */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const out = args.find(a => !a.startsWith('--')) || path.join(root, 'dist', 'except-you.html');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const between = (a, b) => {
  const i = html.indexOf(a), j = html.indexOf(b);
  if (i < 0 || j < 0) throw new Error('missing build marker ' + a);
  return html.slice(i + a.length, j);
};
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const css = read('css/style.css');

let head = between('<!-- build:head -->', '<!-- /build:head -->')
  .replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}</style>`);
let body = between('<!-- build:body -->', '<!-- /build:body -->');
const scripts = between('<!-- build:scripts -->', '<!-- /build:scripts -->');
const inlined = [...scripts.matchAll(/<script src="([^"]+)"><\/script>/g)]
  .map(m => `<script>\n${read(m[1]).replace(/<\/script/gi, '<\\/script')}</script>`)
  .join('\n');
body = body.replace(scripts, '\n' + inlined + '\n');
body = body.replace('<!-- build:scripts -->', '').replace('<!-- /build:scripts -->', '');

const page = fragment
  ? `${head.trim()}\n${body.trim()}\n`
  : `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head.trim()}\n</head>\n<body>\n${body.trim()}\n</body>\n</html>\n`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log(`wrote ${out} (${(page.length / 1024).toFixed(1)} KB${fragment ? ', fragment' : ''})`);
