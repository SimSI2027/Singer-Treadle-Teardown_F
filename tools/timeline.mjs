#!/usr/bin/env node
// Writes the film's timelines from the script itself (no typed numbers):
//   sims/singer-treadle-film/timeline.json        beats only: capture.mjs --stills beats samples each one
//   sims/singer-treadle-film/score-timeline.json  stitches, treadle cycles, part opens, captions, speed: read by the score
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FILM_EVENTS, FILM_CAPTIONS, FILM_DURATION, FILM_RPM, machineTable, timelineBeats} from '../sims/singer-treadle-shared/script.js';
import {RATIO} from '../sims/singer-treadle-shared/kin.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(ROOT, 'sims', 'singer-treadle-film');
fs.mkdirSync(dir, {recursive: true});

fs.writeFileSync(path.join(dir, 'timeline.json'), JSON.stringify(timelineBeats(), null, 2) + '\n');

// the machine's own timing: the balance wheel crosses each 360° at one stitch; the band wheel turns once per treadle cycle
const table = machineTable(FILM_RPM, FILM_DURATION, 1 / 240);
const crossings = (scale) => {
  const out = [];
  let k = 1;
  for (let i = 1; i < table.length; i++) {
    const a = table[i - 1].theta * scale;
    const b = table[i].theta * scale;
    while (b >= k * 360) {
      const f = (k * 360 - a) / (b - a || 1);
      out.push(Number((table[i - 1].t + (table[i].t - table[i - 1].t) * f).toFixed(4)));
      k++;
    }
  }
  return out;
};
const stitches = crossings(1);
const treadles = crossings(RATIO);
const speed = [];
for (let t = 0; t <= FILM_DURATION; t += 0.5) {
  const row = table[Math.min(table.length - 1, Math.round(t * 240))];
  speed.push(Number(row.rpm.toFixed(2)));
}
const opens = FILM_EVENTS.filter((e) => e.type === 'open').map((e) => e.t);
fs.writeFileSync(
  path.join(dir, 'score-timeline.json'),
  JSON.stringify(
    {duration: FILM_DURATION, fps: 60, stitches, treadles, opens, captions: FILM_CAPTIONS.map((c) => c.t0), speed},
    null,
    1,
  ) + '\n',
);
console.log(`timeline: ${FILM_DURATION.toFixed(1)} s, ${opens.length} part opens, ${stitches.length} stitches, ${treadles.length} treadle cycles`);
