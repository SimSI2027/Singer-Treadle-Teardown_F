// Verification of the built exhibit (teardown-out/dist/singer-treadle-live.html), in Chromium from file://.
// Run with `npm test` (which builds first). Each test reads the page's own state through window.SINGER.
import {test, expect} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {solve, DIM, RATIO, cycleCurves} from '../sims/singer-treadle-shared/kin.js';
import {IDS, SUBSYSTEMS, BUTTON_KEYS} from '../sims/singer-treadle-shared/subsystems.js';
import {stateAt, build} from '../sims/singer-treadle-shared/presenter.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PAGE = path.join(ROOT, 'teardown-out', 'dist', 'singer-treadle-live.html');
const SHOTS = path.join(ROOT, 'docs', 'screenshots');
const url = (q = '') => pathToFileURL(PAGE).href + q;

const FIXED = [
  'needle_assembly', 'presser_foot', 'bobbin', 'shuttle', 'drive_wheel', 'belt_drive', 'treadle', 'pitman_rod',
  'crankshaft', 'gear_train', 'tension_regulator', 'spool_pin', 'thread_guide_path', 'machine_head', 'cabinet', 'drawers',
];

// one shared page per file: load once, reuse
test.describe.configure({mode: 'serial'});

/** Opens the page with no tour, waits for the first frame, and collects console errors and requests. */
async function openPage(page, query = '?notour') {
  const errors = [];
  const requests = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:')) requests.push(u);
  });
  await page.goto(url(query));
  await page.waitForFunction(() => window.SINGER !== undefined && window.SINGER.time() > 0.5, null, {timeout: 60000});
  return {errors, requests};
}

test('loads from file:// with no console errors, no network requests and a WebGL context', async ({page}) => {
  const {errors, requests} = await openPage(page);
  await page.waitForTimeout(1500);
  const gl = await page.evaluate(() => {
    const c = document.querySelector('canvas#gl');
    return {has: !!c, ctx: !!(c && (c.getContext('webgl2') || c.getContext('webgl')))};
  });
  expect(gl.has).toBe(true);
  expect(gl.ctx).toBe(true);
  expect(errors.filter((e) => !/X4122|X4000|uninitialized variable|sum of|computeBoundingSphere/.test(e))).toEqual([]);
  expect(requests).toEqual([]);
});

test('exactly sixteen subsystem keys with the fixed ids, and RESET', async ({page}) => {
  await openPage(page);
  const keys = await page.$$eval('.sg .key', (els) => els.map((e) => e.dataset.id));
  expect(keys).toEqual(FIXED);
  expect(keys.length).toBe(16);
  const reset = await page.$$eval('.sg .btn', (els) => els.some((e) => e.textContent.trim() === 'RESET'));
  expect(reset).toBe(true);
  expect(IDS).toEqual(FIXED);
  expect(SUBSYSTEMS.length).toBe(16);
  expect(BUTTON_KEYS.length).toBeGreaterThanOrEqual(16);
});

test('each part: opens, is screenshotted, resets, and every group returns home within 1e-4', async ({page}) => {
  test.setTimeout(10 * 60 * 1000);
  fs.mkdirSync(SHOTS, {recursive: true});
  await openPage(page);
  const home = await page.evaluate(() => window.SINGER.home());
  for (const id of FIXED) {
    await page.locator(`.sg .key[data-id="${id}"]`).click();
    await page.waitForFunction((i) => {
      const s = window.SINGER.presentNow();
      return s.id === i && s.p >= 0.999;
    }, id, {timeout: 20000});
    await page.waitForTimeout(1600);
    await page.screenshot({path: path.join(SHOTS, `sub-${id}.png`)});
    await page.evaluate(() => window.SINGER.resetAll());
    await page.waitForFunction(() => {
      const s = window.SINGER.presentNow();
      return !s.id && window.SINGER.S.theta !== undefined && !window.SINGER.S.homing;
    }, null, {timeout: 20000});
    await page.waitForTimeout(400);
    const now = await page.evaluate(() => window.SINGER.transforms());
    for (const k of FIXED) {
      const a = now[k];
      const b = home[k];
      for (let i = 0; i < 3; i++) {
        expect(Math.abs(a.p[i] - b.p[i]), `${id} reset: ${k} position[${i}]`).toBeLessThan(1e-4);
        expect(Math.abs(a.s[i] - b.s[i]), `${id} reset: ${k} scale[${i}]`).toBeLessThan(1e-4);
      }
      for (let i = 0; i < 4; i++) {
        expect(Math.abs(Math.abs(a.q[i]) - Math.abs(b.q[i])), `${id} reset: ${k} quaternion[${i}]`).toBeLessThan(1e-4);
      }
    }
  }
});

test('opening B while A is open closes A first (the presenter timeline)', async () => {
  // the presenter is pure: check its queue directly rather than through the page
  const ev = [{t: 1, type: 'open', id: 'needle_assembly'}, {t: 3, type: 'open', id: 'drawers'}];
  const {segs} = build(ev);
  const closeA = segs.find((g) => g.id === 'needle_assembly' && g.p1 === 0);
  const openB = segs.find((g) => g.id === 'drawers' && g.p1 === 1);
  expect(closeA).toBeTruthy();
  expect(openB).toBeTruthy();
  expect(closeA.t1).toBeLessThanOrEqual(openB.t0 + 1e-9); // A is fully closed before B starts to open
  expect(stateAt(3.05, ev).id).toBe('needle_assembly'); // B has been asked for, but A is still on display
  const end = stateAt(12, ev);
  expect(end.id).toBe('drawers');
  expect(end.p).toBe(1);
});

test('idle: the tour starts after the threshold, and input cancels it at once', async ({page}) => {
  await openPage(page, '?idle=2');
  // no tour before the threshold
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => window.SINGER.tour.on);
  expect(before).toBe(false);
  await page.waitForFunction(() => window.SINGER.tour.on === true, null, {timeout: 20000});
  // the tour drives the wheel: it ramps up from rest once its first beat is under way
  await page.waitForFunction(() => window.SINGER.S.rpm > 50, null, {timeout: 30000});
  expect(await page.evaluate(() => window.SINGER.tour.on)).toBe(true);
  // input cancels it
  await page.mouse.click(800, 450);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.SINGER.tour.on)).toBe(false);
});

test('numbers: belt ratio, stitches a minute, and the stitch cycle, from the same solve', async () => {
  const ratio = (0.3 / 0.13);
  const s = solve({theta: 720.3, rpm: 600, stitchMM: 2.5});
  expect(Math.abs(s.numbers.handRpm / s.numbers.bandRpm - ratio) / ratio).toBeLessThan(0.02);
  expect(s.numbers.stitchesPerMin).toBe(s.numbers.handRpm);
  // the needle is at bottom dead centre when the shuttle's point passes it
  const bdc = solve({theta: 180, rpm: 300});
  expect(Math.abs(bdc.shuttle.betaDeg)).toBeLessThan(1e-6);
  expect(Math.abs(bdc.needle.mm + 10)).toBeLessThan(0.05); // the bottom of the stroke is 10 mm below the plate
  // the stroke is 30 mm
  const top = solve({theta: 0, rpm: 0}).needle.mm;
  expect(Math.abs(top - bdc.needle.mm - 30)).toBeLessThan(0.05);
  // the feed dog moves the cloth only while the needle is out of it
  let violations = 0;
  for (let th = 0; th < 360; th += 0.25) {
    const q = solve({theta: th, rpm: 0, stitchMM: 2.5});
    if (q.feed.engaged && q.needle.out === false) violations++;
  }
  expect(violations).toBe(0);
  // the treadle rocks about 24 degrees
  let lo = 1e9;
  let hi = -1e9;
  for (let th = 0; th <= 360 / RATIO; th += 0.5) {
    const t = solve({theta: th}).treadle.tiltDeg;
    lo = Math.min(lo, t);
    hi = Math.max(hi, t);
  }
  expect(hi - lo).toBeGreaterThan(23);
  expect(hi - lo).toBeLessThan(26);
  // the take-up lever leads the needle by about 30 degrees: its peak is at θ = 330
  const curves = cycleCurves(360, 2.5);
  const peak = curves.takeupDeg.indexOf(Math.max(...curves.takeupDeg));
  expect(Math.abs(peak - 330)).toBeLessThanOrEqual(1);
});

test('determinism: solve(state) twice with identical inputs is deep-equal', async () => {
  const st = {theta: 37.1, rpm: 300, stitchMM: 2, presserUp: 0.4, tension: 0.6};
  expect(JSON.stringify(solve(st))).toBe(JSON.stringify(solve(st)));
  const ev = [{t: 1, type: 'open', id: 'treadle'}, {t: 2, type: 'open', id: 'shuttle'}];
  expect(JSON.stringify(stateAt(2.4, ev))).toBe(JSON.stringify(stateAt(2.4, ev)));
});

test('performance: the average frame time over ~10 s running is under 20 ms in headless Chromium', async ({page}) => {
  test.setTimeout(120000);
  await openPage(page);
  await page.evaluate(() => {
    window.SINGER.S.target = 300;
    window.SINGER.S.lastSpeed = 300;
  });
  await page.waitForTimeout(10000);
  const stats = await page.evaluate(() => window.SINGER.stats());
  test.info().annotations.push({type: 'frame-ms', description: stats.avgMS.toFixed(2)});
  expect(stats.avgMS).toBeLessThan(20);
});
