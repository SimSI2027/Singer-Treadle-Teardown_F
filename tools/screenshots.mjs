#!/usr/bin/env node
// Screenshots of the live page for the README, the site and the crosscheck: the overview, a running machine, the idle tour
// with a caption, a part on display for each of the sixteen (docs/screenshots/sub-<id>.png), and the hero.
// Needs teardown-out/dist/singer-treadle-live.html (npm run build).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {CHROMIUM, CHROMIUM_ARGS, DEPS} from '../paths.mjs';
import {IDS} from '../sims/singer-treadle-shared/subsystems.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(path.join(ROOT, 'package.json'));
const {chromium} = req('playwright');
const page_ = path.join(ROOT, 'teardown-out', 'dist', 'singer-treadle-live.html');
const OUT = path.join(ROOT, 'docs', 'screenshots');
// --only=id1,id2 refreshes just those parts' screenshots (the overview, running, hero and tour are then left alone)
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;
if (!fs.existsSync(page_)) {
  console.error(`missing ${page_}: run npm run build first`);
  process.exit(1);
}
fs.mkdirSync(OUT, {recursive: true});

const browser = await chromium.launch({executablePath: CHROMIUM, args: CHROMIUM_ARGS});
const page = await browser.newPage({viewport: {width: 1600, height: 900}, deviceScaleFactor: 1.25});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
const open = async (q) => {
  await page.goto(pathToFileURL(page_).href + q);
  await page.waitForFunction(() => window.SINGER !== undefined && window.SINGER.time() > 0.5, null, {timeout: 60000});
};

// the overview at rest (the first frame, with the console)
if (!only) {
await open('?notour');
await page.waitForTimeout(1200);
await page.screenshot({path: path.join(OUT, 'overview.png')});

// running at 300 stitches a minute
await page.evaluate(() => {
  window.SINGER.S.target = 300;
  window.SINGER.S.lastSpeed = 300;
});
await page.waitForTimeout(3500);
await page.screenshot({path: path.join(OUT, 'running.png')});

// the hero: running, with the balance wheel on display
await page.evaluate(() => window.SINGER.openPart('drive_wheel'));
await page.waitForTimeout(2600);
await page.screenshot({path: path.join(OUT, 'hero.png')});
await page.evaluate(() => window.SINGER.resetAll());
await page.waitForTimeout(1500);
}

// each part on display (with --only, the page is opened here)
if (only) await open('?notour');
for (const id of only ?? IDS) {
  await page.evaluate((i) => window.SINGER.openPart(i), id);
  await page.waitForFunction((i) => {
    const s = window.SINGER.presentNow();
    return s.id === i && s.p >= 0.999;
  }, id, {timeout: 20000});
  await page.waitForTimeout(1600);
  await page.screenshot({path: path.join(OUT, `sub-${id}.png`)});
  await page.evaluate(() => window.SINGER.resetAll());
  await page.waitForTimeout(1400);
}

// the idle tour, with a caption on screen
if (!only) {
await open('?idle=0.5');
await page.waitForFunction(() => window.SINGER.tour.on === true, null, {timeout: 20000});
await page.waitForTimeout(9000);
await page.screenshot({path: path.join(OUT, 'tour.png')});
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ids: IDS, files: fs.readdirSync(OUT).filter((f) => f.endsWith('.png'))}, null, 1));
await browser.close();
console.log(`screenshots: ${fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length} files in docs/screenshots/`);
if (errors.length) console.log('page errors:\n' + errors.slice(0, 5).join('\n'));
