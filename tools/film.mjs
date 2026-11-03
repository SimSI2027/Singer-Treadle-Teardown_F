#!/usr/bin/env node
// The film, end to end: timeline → build → frame-accurate capture (60 fps, silent) → procedural score → mux →
// docs/assets/film.mp4 and a poster frame. Long: about 80 s of film is about 4,800 frames.
//   node tools/film.mjs              everything
//   node tools/film.mjs --score      only the score and the mux (the video must exist in teardown-out/)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync, spawnSync} from 'node:child_process';
import {FFMPEG, PYTHON, OUT} from '../paths.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.includes('--score');
const run = (cmd, args) => {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, {cwd: ROOT, stdio: 'inherit'});
  if (r.status !== 0) throw new Error(`${cmd} exited ${r.status}`);
};
const out = path.join(OUT);
fs.mkdirSync(out, {recursive: true});
const silent = path.join(out, 'singer-treadle-silent.mp4');
const wav = path.join(out, 'singer-treadle-score.wav');
const final = path.join(ROOT, 'docs', 'assets', 'film.mp4');
const poster = path.join(ROOT, 'docs', 'assets', 'film-poster.jpg');
fs.mkdirSync(path.dirname(final), {recursive: true});

if (!only) {
  run(process.execPath, ['tools/timeline.mjs']);
  run(process.execPath, ['sims/build.mjs', 'singer-treadle-film']);
  run(process.execPath, ['sims/capture.mjs', 'singer-treadle-film', '--size', '1600x900', '--dpr', '1.2', '--crf', '20', '--out', silent]);
}
// the score: every time comes from score-timeline.json
run(PYTHON, ['run_sfx.py', 'sims/singer-treadle-shared/score.py']);
// mux: the silent picture and the mastered score, AAC, faststart
run(FFMPEG, ['-loglevel', 'error', '-y', '-i', silent, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', final]);
run(FFMPEG, ['-loglevel', 'error', '-y', '-ss', '6.5', '-i', final, '-frames:v', '1', '-q:v', '3', poster]);
const size = fs.statSync(final).size;
console.log(`film: ${final} (${(size / 1048576).toFixed(1)} MB), poster: ${poster}`);
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'sheets.mjs'), '--check', final], {stdio: 'inherit'});
