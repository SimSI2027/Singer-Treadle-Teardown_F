#!/usr/bin/env node
// Builds docs/index.html (the GitHub Pages site) from the exhibit's own data: the sixteen texts and facts
// (sims/singer-treadle-shared/subsystems.js), the stitch-cycle curves (kin.js cycleCurves) drawn as an inline SVG, and
// the screenshots and film already in docs/. Run after the screenshots and the film: npm run site.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SUBSYSTEMS} from '../sims/singer-treadle-shared/subsystems.js';
import {cycleCurves, DIM, RATIO_LABEL} from '../sims/singer-treadle-shared/kin.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const has = (p) => fs.existsSync(path.join(DOCS, p));

// ---------------------------------------------------------------- the stitch cycle as an inline SVG (from the solver)
function cycleSvg() {
  const c = cycleCurves(360, DIM.feed.S);
  const W = 760;
  const H = 240;
  const X = (deg) => 50 + (deg / 360) * (W - 80);
  const Yn = (mm) => 20 + ((22 - mm) / 34) * (H - 50); // needle: +22 mm top .. −12 mm bottom
  const Ya = (deg) => 20 + ((40 - deg) / 80) * (H - 50); // take-up and shuttle: ±40°
  const Yf = (mm) => 20 + ((2.6 - mm) / 5.2) * (H - 50); // feed dog: ±2.6 mm
  const path = (vals, f, col, dash = '') =>
    `<path d="${vals.map((v, i) => `${i ? 'L' : 'M'}${X(c.theta[i]).toFixed(1)} ${f(v).toFixed(1)}`).join('')}" fill="none" stroke="${col}" stroke-width="2" ${dash}/>`;
  const ticks = [0, 90, 180, 270, 360].map((d) => `<line x1="${X(d)}" x2="${X(d)}" y1="16" y2="${H - 26}" stroke="#e1e3e6"/><text x="${X(d)}" y="${H - 8}" font-size="12" text-anchor="middle" fill="#7d8187">${d}°</text>`).join('');
  return `<svg class="cycle" viewBox="0 0 ${W} ${H}" role="img" aria-label="Stitch cycle over one turn of the balance wheel">
    ${ticks}
    <line x1="50" x2="${W - 30}" y1="${Yn(0)}" y2="${Yn(0)}" stroke="#c9ccd0" stroke-dasharray="4 3"/>
    ${path(c.needleMM, Yn, '#16181b')}
    ${path(c.takeupDeg, Ya, '#d6182b')}
    ${path(c.shuttleDeg, Ya, '#5d6670', 'stroke-dasharray="6 4"')}
    ${path(c.feedZ.map((z, i) => z * 1000), Yf, '#8f6d2a')}
    <text x="${X(180)}" y="${Yn(-10) + 16}" font-size="12" text-anchor="middle" fill="#16181b">hook passes the needle at the bottom of the stroke</text>
  </svg>`;
}

// ---------------------------------------------------------------- the sixteen cards
const card = (s) => {
  const img = has(`screenshots/sub-${s.id}.png`) ? `<img src="screenshots/sub-${s.id}.png" alt="${esc(s.name)} on display" loading="lazy">` : '';
  return `<article class="card" id="${s.id}">
    ${img}
    <div class="cbody">
      <div class="num">${String(s.n).padStart(2, '0')}</div>
      <h3>${esc(s.name)}</h3>
      <div class="hint">${esc(s.hint)}</div>
      <p>${esc(s.text)}</p>
      <p class="fact"><b>Period fact.</b> ${esc(s.fact)}</p>
      <p class="conn"><b>Connected to</b> ${s.connects.map((c) => esc(SUBSYSTEMS.find((x) => x.id === c)?.name ?? c)).join(', ')}</p>
    </div>
  </article>`;
};

const shot = (file, caption) =>
  has(file) ? `<figure><img src="${file}" alt="${esc(caption)}" loading="lazy"><figcaption>${esc(caption)}</figcaption></figure>` : '';

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Singer Treadle · Teardown</title>
<meta name="description" content="An interactive, offline simulator of an antique Singer treadle sewing machine: sixteen parts, real kinematics, an idle tour and a film.">
<link rel="stylesheet" href="style.css">
</head>
<body>
<header class="top">
  <div class="wrap">
    <div class="brand"><span class="bar"></span> Singer Treadle <span class="dot">·</span> Teardown</div>
    <nav><a href="#exhibit">Exhibit</a><a href="#film">Film</a><a href="#parts">The sixteen parts</a><a href="#cycle">Stitch cycle</a><a href="#build">Build</a><a href="#notes">Notes</a></nav>
  </div>
</header>

<section class="hero">
  <div class="wrap">
    <p class="kicker">c. 1880–1915 · vibrating shuttle · belt drive ${esc(RATIO_LABEL)} : 1</p>
    <h1>A Singer treadle machine, taken apart on screen.</h1>
    <p class="lede">Press a number and that part comes forward to the middle of the screen. The rest of the machine fades, a card explains what the part does, what it connects to, and a period fact. Left alone, the page tours the drive chain on its own.</p>
    <div class="cta">
      <a class="btn primary" href="#exhibit">Open the exhibit</a>
      <a class="btn" href="assets/film.mp4">Watch the film</a>
      <a class="btn" href="https://github.com/SimSI2027/Singer-Treadle-Teardown_F">Source on GitHub</a>
    </div>
    ${shot('screenshots/hero.png', 'The balance wheel on display, with the machine ghosted behind it')}
  </div>
</section>

<section id="exhibit" class="band">
  <div class="wrap">
    <h2>The exhibit</h2>
    <p>The page below is the same file as <code>dist/singer-treadle.html</code>: one HTML page, three.js and the fonts inside, no network requests. It opens from your disk too.</p>
    <div class="frame"><iframe src="exhibit.html" title="Singer treadle exhibit (interactive)" loading="lazy" allow="fullscreen"></iframe></div>
    <p class="small">Keys: <kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd>, <kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>T</kbd> <kbd>Y</kbd> <kbd>U</kbd> open the sixteen parts · <kbd>Space</kbd> run/pause · <kbd>R</kbd> reset · drag the balance wheel to scrub the stitch · drag the machine to orbit · scroll to zoom · after 25 s of quiet, the auto tour starts and any input takes over.</p>
    <p class="small"><a href="exhibit.html" target="_blank" rel="noopener">Open the exhibit in its own tab</a></p>
  </div>
</section>

<section class="band">
  <div class="wrap two">
    <div>
      <h2>An antique machine, and what it was for</h2>
      <p>Elias Howe's 1846 patent put an eye-pointed needle on a lockstitch machine. Isaac Singer's machine, patented in 1851, carried a needle that moved straight up and down. Allen B. Wilson's patent of 19 December 1854 (US 12,116) described the four-motion feed, which moves the cloth up, forward, down and back. The model 27 vibrating-shuttle machine was built from 1891 to 1913, and its updated successor, the 127, from about 1910.</p>
      <p>Singer sold on instalments; its partner Edward Cabot Clark is usually credited with the 1856 plan, though some sources credit Isaac Singer. Treadle outfits were sold with a cabinet, drawers and a box of attachments, and the treadle is what turned a foot into a stitch.</p>
      <p class="small">Sources and what could not be verified: <a href="https://github.com/SimSI2027/Singer-Treadle-Teardown_F/blob/main/docs/research/source-notes.md">docs/research/source-notes.md</a>.</p>
    </div>
    <div>${shot('screenshots/overview.png', 'The machine at rest, the console on the right and along the bottom')}</div>
  </div>
</section>

<section id="film" class="band">
  <div class="wrap">
    <h2>The film</h2>
    <p>Seventy-five seconds at 60 frames a second, rendered frame by frame from the same script that drives the exhibit's tour: the drive chain from the treadle to the needle, the shuttle and the feed, the thread path, then the whole machine. The score is procedural: a treadle clack per cycle, a tick per stitch, and a chime when a part comes forward.</p>
    <video controls preload="metadata" poster="assets/film-poster.jpg" src="assets/film.mp4" width="100%"></video>
    <p class="small">Stills from the review sheet: <a href="review/film-beats-r1.png">the film's beats, round 1</a>.</p>
  </div>
</section>

<section id="parts" class="band">
  <div class="wrap">
    <h2>The sixteen parts</h2>
    <p>Each card is the part on display in the exhibit, with its text and its period fact. The numbers and names are the buttons on the console.</p>
    <div class="grid">${SUBSYSTEMS.map(card).join('\n')}</div>
  </div>
</section>

<section id="cycle" class="band">
  <div class="wrap two">
    <div>
      <h2>One stitch, one turn of the balance wheel</h2>
      <p>The needle is the black line: 30 mm of stroke, out of the cloth above the plate and into it below. The take-up lever (red) leads the needle by 30° and draws up the thread. The shuttle (dashed) swings through the loop at the needle's lowest point, when its hook passes the needle. The feed dog (brown) rises through the plate only in a short window while the needle is out of the cloth, and moves the cloth forward by the stitch length.</p>
      <p>The treadle is a four-bar linkage: it rocks through about 24° and drives the band wheel, which is 2.31 times the balance wheel's diameter, so the balance wheel turns 2.31 times for each treadle cycle.</p>
    </div>
    <div>${cycleSvg()}</div>
  </div>
</section>

<section id="build" class="band">
  <div class="wrap">
    <h2>How it is made</h2>
    <div class="arch">
      <div class="box"><b>sims/singer-treadle-shared</b><span>the machine: <code>kin.js</code> (pure kinematics), <code>subsystems.js</code> (the sixteen parts), <code>machine.js</code> (geometry and posing), <code>presenter.js</code> and <code>script.js</code> (the timeline), <code>console.js</code> and <code>stage.js</code> (the overlay and the stage)</span></div>
      <div class="arrow">→</div>
      <div class="box"><b>sims/singer-treadle-live</b><span>the page you drive: fixed-step simulation, input, idle tour</span></div>
      <div class="box"><b>sims/singer-treadle-film</b><span>the film: <code>render(t)</code> as a pure function of time</span></div>
      <div class="box"><b>sims/build.mjs</b><span>esbuild bundle, three.js and fonts inlined → one offline HTML file</span></div>
      <div class="box"><b>sims/capture.mjs</b><span>frame-accurate capture at 60 fps (Playwright) → mp4</span></div>
      <div class="box"><b>sfx/ and score.py</b><span>procedural sound on the film's timeline, mastered to −14 LUFS</span></div>
      <div class="box"><b>tests/ and tools/crosscheck.mjs</b><span>the Playwright suite; the registry cross-check</span></div>
    </div>
    <h3>Build and test</h3>
    <pre><code>npm install &amp;&amp; npx playwright install chromium
npm run build        # dist/singer-treadle.html
npm test             # build, cross-check, Playwright suite
npm run film         # the film with its score (needs ffmpeg and Python 3)
npm run screenshots  # the images on this page</code></pre>
    <h3>Technical notes</h3>
    <ul>
      <li><b>Kinematics.</b> One master angle, the balance wheel. The treadle is a four-bar linkage solved by circle intersection; the needle bar is a slider-crank; the shuttle, the take-up lever and the feed dog are functions of the same angle.</li>
      <li><b>Geometry.</b> Procedural three.js: wheels as tori and boxes, the lattice standards and the treadle plate as merged boxes, the oak grain and the gold decal drawn on canvases at load.</li>
      <li><b>Presentation.</b> A moved part travels from its home to the display point, turns and scales about its own pivot, with a bow in the home frame. The rest of the machine is ghosted by the same progress value.</li>
      <li><b>Determinism.</b> The live page steps the simulation at 1/120 s. The film reads its wheel angle from a table computed from the speed script, so frame t is the same frame however it is reached.</li>
    </ul>
  </div>
</section>

<section id="notes" class="band">
  <div class="wrap">
    <h2>Development and review</h2>
    <p>The review loop renders the film's beats as a sheet and reads it against a checklist before each change. Round 1 is in <a href="review/NOTES.md">docs/review/NOTES.md</a>. More of the running machine:</p>
    <div class="shots">
      ${shot('screenshots/running.png', 'Running at 300 stitches a minute')}
      ${shot('screenshots/tour.png', 'The idle tour, with its caption')}
      ${shot('review/film-beats-r1.png', 'The film, every beat (review sheet, round 1)')}
    </div>
    <h2>Controls</h2>
    <table>
      <tr><th>Action</th><th>Control</th></tr>
      <tr><td>Open a part</td><td>click it, or <kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd>, <kbd>Q W E T Y U</kbd>; the same key closes it</td></tr>
      <tr><td>Run / pause</td><td><kbd>Space</kbd> or RUN</td></tr>
      <tr><td>Speed</td><td>drag the speed slider (0–900 stitches a minute); hold PUMP or <kbd>P</kbd></td></tr>
      <tr><td>Stitch length</td><td>drag the stitch-length slider (0–4 mm)</td></tr>
      <tr><td>Presser foot</td><td><kbd>L</kbd> or PRESSER</td></tr>
      <tr><td>Scrub the stitch</td><td>drag the balance wheel</td></tr>
      <tr><td>Orbit / zoom</td><td>drag the machine / scroll</td></tr>
      <tr><td>Reset</td><td><kbd>R</kbd>, <kbd>Esc</kbd> or RESET</td></tr>
    </table>
    <h2>Changelog and roadmap</h2>
    <p>Rebuilt on the teardown skill. The earlier Teardown-game mod was removed; its research is archived under <code>docs/research/</code>. Full history: <a href="https://github.com/SimSI2027/Singer-Treadle-Teardown_F/blob/main/CHANGELOG.md">CHANGELOG.md</a>. Next: <a href="https://github.com/SimSI2027/Singer-Treadle-Teardown_F/blob/main/ROADMAP.md">ROADMAP.md</a>.</p>
  </div>
</section>

<footer class="wrap small">
  MIT licence. Built on the <a href="https://github.com/elvarofficial/teardown">teardown skill</a>. Singer is a trademark of its owner; this is an independent educational model.
</footer>
</body>
</html>
`;

fs.mkdirSync(DOCS, {recursive: true});
fs.writeFileSync(path.join(DOCS, 'index.html'), html);
console.log(`docs/index.html  ${(html.length / 1024).toFixed(0)} KB`);
