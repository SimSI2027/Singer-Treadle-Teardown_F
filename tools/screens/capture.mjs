// Renders docs/screenshots/*.png (and the mod's preview.jpg) from the web edition.
// The web edition loads the same voxels the mod ships, so these show the real geometry and the real
// choreography, but they are browser renders, not in-game captures.
//
//   cd tools/screens && npm install && node capture.mjs [--only substring]
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOCS = path.join(ROOT, 'docs');
const OUT = path.join(DOCS, 'screenshots');
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.bin': 'application/octet-stream', '.png': 'image/png', '.md': 'text/markdown'};
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(DOCS, p.endsWith('/') ? p + 'index.html' : p);
  if (!file.startsWith(DOCS) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const exhibit = JSON.parse(fs.readFileSync(path.join(DOCS, 'assets', 'exhibit.json'), 'utf8'));
const shots = [
  {file: '01-complete-machine.png', q: 'cam=hero&tour=0&freeze=1', caption: 'The complete exhibit: machine on its plinth, display dais, brass console'},
  {file: '02-console.png', q: 'cam=console&tour=0&freeze=1', caption: 'The console: 16 numbered subsystem buttons, RESET and RUN'},
  {file: '03-machine-closeup.png', q: 'cam=machine&tour=0&freeze=1', caption: 'The head: sectioned arm and needle end, gold decals, thread path'},
  {file: '04-anim-withdraw.png', q: 'open=needle_assembly&t=0.55&cam=machine&freeze=1', caption: 'Animation: the needle assembly withdraws forward along its exit path'},
  {file: '05-anim-shift.png', q: 'open=treadle&t=1.15&cam=hero&freeze=1', caption: 'Animation: the machine slides aside as one rigid group'},
  {file: '06-anim-makeway.png', q: 'open=machine_head&t=0.82&cam=hero&freeze=1', caption: 'Frame mode: every part makes way before the head lifts out'},
  {file: '07-anim-present.png', q: 'open=gear_train&t=2.0&cam=display&freeze=1', caption: 'Animation: the feed mechanism rides its Bezier to the display point'},
  {file: '08-run.png', q: 'run=2.6&cam=machine&tour=0&freeze=1', caption: 'RUN: treadle, pitman, band wheel, belt, balance wheel and needle bar in motion'},
];
exhibit.SUBSYSTEMS.forEach((s, i) => {
  shots.push({file: `sub-${String(i + 1).padStart(2, '0')}-${s.id}.png`, q: `show=${s.id}&sway=0.6&cam=auto&freeze=1`, caption: `${i + 1} · ${s.name} on display`});
});
shots.push({file: '99-final-exhibit.png', q: 'show=belt_drive&sway=0.9&cam=hero&freeze=1', caption: 'Final exhibit: a subsystem on display beside the shifted machine'});

const browser = await chromium.launch({args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']});
const page = await browser.newPage({viewport: {width: 1440, height: 1100}, deviceScaleFactor: 1});
page.on('pageerror', (e) => console.error('page error:', e.message));
fs.mkdirSync(OUT, {recursive: true});
const manifest = [];
for (const s of shots) {
  if (only && !s.file.includes(only)) { manifest.push(s); continue; }
  await page.goto(base + 'index.html?' + s.q, {waitUntil: 'networkidle'});
  await page.waitForFunction(() => window.__ready === true, null, {timeout: 60000});
  await page.waitForTimeout(900);
  const stage = await page.$('.stage');
  await stage.screenshot({path: path.join(OUT, s.file)});
  manifest.push({file: s.file, caption: s.caption});
  console.log('captured', s.file);
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest.map(({file, caption}) => ({file, caption})), null, 1));

// the mod's preview image (Teardown shows it in the mod manager)
if (!only) {
  await page.setViewportSize({width: 1200, height: 900});
  await page.goto(base + 'index.html?cam=hero&tour=0&freeze=1&show=needle_assembly&sway=0.6', {waitUntil: 'networkidle'});
  await page.waitForFunction(() => window.__ready === true);
  await page.waitForTimeout(900);
  await (await page.$('.stage')).screenshot({path: path.join(ROOT, 'preview.jpg'), type: 'jpeg', quality: 88});
  console.log('captured preview.jpg');
}
await browser.close();
server.close();
