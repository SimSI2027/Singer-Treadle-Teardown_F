#!/usr/bin/env node
// Review sheets for the review loop (SKILL.md): one tile per film beat, each labelled with its time, into docs/review/.
//   node tools/sheets.mjs <round>        stills of every beat of the film (needs the built film page)
//   node tools/sheets.mjs --check <mp4> the encoder's output, one tile per beat (sheet.mjs)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {FFMPEG, PYTHON} from '../paths.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const review = path.join(ROOT, 'docs', 'review');
fs.mkdirSync(review, {recursive: true});
const call = (cmd, a) => {
  const r = spawnSync(cmd, a, {cwd: ROOT, stdio: 'inherit'});
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (args[0] === '--check') {
  call(process.execPath, [path.join(ROOT, 'sheet.mjs'), '--video', args[1], '--timeline', path.join(ROOT, 'sims', 'singer-treadle-film', 'timeline.json')]);
} else {
  const round = args[0] ?? 'round';
  const sheet = path.join(review, `film-beats-${round}.png`);
  call(process.execPath, [
    path.join(ROOT, 'sims', 'capture.mjs'), 'singer-treadle-film', '--size', '1600x900', '--dpr', '1', '--stills', 'beats', '--cols', '4', '--out', sheet,
  ]);
  console.log(`review sheet: ${path.relative(ROOT, sheet)}`);
}
void PYTHON;
void FFMPEG;
