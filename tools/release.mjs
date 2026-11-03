#!/usr/bin/env node
// Copies the built page to where the project publishes it: dist/singer-treadle.html (the offline exhibit) and
// docs/exhibit.html (the copy the Pages site embeds and links). Run after `node sims/build.mjs singer-treadle-live`.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(ROOT, 'teardown-out', 'dist', 'singer-treadle-live.html');
if (!fs.existsSync(src)) {
  console.error(`missing ${src}: run node sims/build.mjs singer-treadle-live first`);
  process.exit(1);
}
const html = fs.readFileSync(src);
for (const out of [path.join(ROOT, 'dist', 'singer-treadle.html'), path.join(ROOT, 'docs', 'exhibit.html')]) {
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(out, html);
  console.log(`${path.relative(ROOT, out)}  ${(html.length / 1024).toFixed(0)} KB`);
}
