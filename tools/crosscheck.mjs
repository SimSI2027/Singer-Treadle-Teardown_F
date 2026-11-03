#!/usr/bin/env node
// Cross-check of the registry against everything that must refer to it. Fails (exit 1) on any mismatch:
//   every subsystem id has: a fixed id, a key, a button label, a text, a period fact, valid connections, callouts,
//   a camera preset, a tour beat (the open event in the tour script), an entry in the built page (its registry literal),
//   and a screenshot in docs/screenshots/.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SUBSYSTEMS, IDS, BY_ID, BUTTON_KEYS} from '../sims/singer-treadle-shared/subsystems.js';
import {TOUR_EVENTS} from '../sims/singer-treadle-shared/script.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXED = [
  'needle_assembly', 'presser_foot', 'bobbin', 'shuttle', 'drive_wheel', 'belt_drive', 'treadle', 'pitman_rod',
  'crankshaft', 'gear_train', 'tension_regulator', 'spool_pin', 'thread_guide_path', 'machine_head', 'cabinet', 'drawers',
];
const problems = [];
const fail = (id, msg) => problems.push(`${id}: ${msg}`);

if (SUBSYSTEMS.length !== 16) problems.push(`registry has ${SUBSYSTEMS.length} entries, expected 16`);
if (JSON.stringify(IDS) !== JSON.stringify(FIXED)) problems.push(`ids differ from the fixed list: ${IDS.join(', ')}`);
if (BUTTON_KEYS.length < 16) problems.push(`only ${BUTTON_KEYS.length} keys for 16 parts`);
if (new Set(BUTTON_KEYS).size !== BUTTON_KEYS.length) problems.push('duplicate keys');

const tourOpens = new Set(TOUR_EVENTS.filter((e) => e.type === 'open').map((e) => e.id));
const dist = path.join(ROOT, 'teardown-out', 'dist', 'singer-treadle-live.html');
const distText = fs.existsSync(dist) ? fs.readFileSync(dist, 'utf8') : null;
const shots = path.join(ROOT, 'docs', 'screenshots');

for (const s of SUBSYSTEMS) {
  if (!FIXED.includes(s.id)) fail(s.id, 'not one of the fixed ids');
  if (!s.button) fail(s.id, 'no button label');
  if (!s.name) fail(s.id, 'no display name');
  if (!s.text || s.text.length < 60) fail(s.id, 'function text missing or too short');
  if (!s.fact || s.fact.length < 30) fail(s.id, 'period fact missing or too short');
  if (!s.cam) fail(s.id, 'no open-view camera preset');
  if (!s.callouts || s.callouts.length < 2) fail(s.id, 'fewer than two callouts');
  for (const c of s.connects || []) if (!BY_ID[c]) fail(s.id, `connects to unknown id ${c}`);
  if (!tourOpens.has(s.id)) fail(s.id, 'no tour beat (no open event in the tour script)');
  // the registry is bundled as string literals; the key elements themselves are checked by the Playwright suite
  if (distText !== null && !distText.includes(`"${s.id}"`)) fail(s.id, 'not in the built page (no registry entry)');
  if (fs.existsSync(shots) && !fs.existsSync(path.join(shots, `sub-${s.id}.png`))) fail(s.id, 'no screenshot docs/screenshots/sub-<id>.png');
}
if (distText === null) console.log('note: dist not built yet; the built-page check was skipped');
if (!fs.existsSync(shots)) console.log('note: docs/screenshots not made yet; the screenshot check was skipped');

if (problems.length) {
  console.error(`crosscheck FAILED (${problems.length})`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(`crosscheck OK: 16 parts, ${BUTTON_KEYS.length} keys, ${tourOpens.size} tour beats, ${distText ? 'page' : 'no page'}, ${fs.existsSync(shots) ? 'screenshots' : 'no screenshots'}`);
