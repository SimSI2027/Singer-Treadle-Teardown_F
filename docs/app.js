// Page wiring: console keys, info panel, gallery cards, timeline, screenshots, changelog/roadmap.
import {boot} from './viewer.js';

const $ = (s) => document.querySelector(s);
const REPO_RAW = 'https://raw.githubusercontent.com/SimSI2027/Singer-Treadle-Teardown_F/main/';
const exhibit = await fetch('assets/exhibit.json').then((r) => r.json());
const SUBS = exhibit.SUBSYSTEMS;
const CFG = exhibit.CONFIG;
const NAMES = Object.fromEntries(SUBS.map((s) => [s.id, s.name]));
NAMES.reset = 'Reset exhibit';
NAMES.run = 'Run the machine';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

// ---------------------------------------------------------------- console keys
const keys = $('#keys');
SUBS.forEach((s, i) => {
  const b = document.createElement('button');
  b.className = 'key';
  b.dataset.id = s.id;
  b.title = s.name;
  b.innerHTML = `<span class="num">${i + 1}</span><span class="lbl">${esc(s.name)}</span>`;
  keys.appendChild(b);
});

// ---------------------------------------------------------------- gallery cards
const cards = $('#cards');
SUBS.forEach((s, i) => {
  const c = document.createElement('article');
  c.className = 'card';
  c.dataset.id = s.id;
  c.tabIndex = 0;
  c.innerHTML = `
    <header><span class="card-num">${String(i + 1).padStart(2, '0')}</span><h3>${esc(s.name)}</h3></header>
    <p>${esc(s.text)}</p>
    <p class="card-conn"><span>Connected to</span> ${s.connects.map((x) => `<a href="#exhibit" data-go="${x}">${esc(NAMES[x])}</a>`).join(' · ')}</p>
    <p class="card-fact">${esc(s.fact)}</p>
    <button class="card-go" data-go="${s.id}">Show on the exhibit ↑</button>`;
  cards.appendChild(c);
});

// ---------------------------------------------------------------- timeline bars from CONFIG
const tl = $('#timeline');
const rows = [
  ['Withdraw (part)', CFG.LIFT_START, CFG.LIFT_END],
  ['Group slides aside', CFG.SHIFT_START, CFG.SHIFT_END],
  ['Present (Bezier)', CFG.PRESENT_START, CFG.PRESENT_END],
  ['Articulate', CFG.ARTICULATE_START, CFG.ARTICULATE_END],
  ['Make way (frame)', CFG.LIFT_START, CFG.LIFT_END],
  ['Frame lifts', CFG.FRAME_LIFT_START, CFG.FRAME_LIFT_END],
  ['Group slides (frame)', CFG.FRAME_SHIFT_START, CFG.FRAME_SHIFT_END],
];
const span = CFG.OPEN_TIME;
tl.innerHTML = rows.map(([name, a, b], i) => `
  <div class="tl-row${i >= 4 ? ' frame' : ''}"><span class="tl-name">${name}</span>
  <span class="tl-track"><span class="tl-bar" style="left:${(a / span) * 100}%;width:${((b - a) / span) * 100}%"></span></span>
  <span class="tl-t">${a.toFixed(2)}–${b.toFixed(2)} s</span></div>`).join('') +
  `<div class="tl-axis"><span>0</span><span>${(span / 2).toFixed(1)} s</span><span>${span.toFixed(1)} s</span></div>`;

// ---------------------------------------------------------------- viewer
const panel = $('#panel');
let viewer = null;
function showPanel(id) {
  const i = SUBS.findIndex((s) => s.id === id);
  const s = SUBS[i];
  $('#p-kicker').textContent = `Subsystem ${i + 1} of ${SUBS.length}`;
  $('#p-name').textContent = s.name;
  $('#p-text').textContent = s.text;
  $('#p-conn').textContent = s.connects.map((x) => NAMES[x]).join('  ·  ');
  $('#p-fact').textContent = s.fact;
  panel.classList.add('on');
}
function onState(st) {
  document.querySelectorAll('.key').forEach((k) => k.classList.toggle('active', k.dataset.id === (st.mode === 'RUN' ? 'run' : st.id)));
  document.querySelectorAll('.card').forEach((k) => k.classList.toggle('active', k.dataset.id === st.id));
  const text = {
    IDLE: st.tour ? 'Touring: click anywhere to take over' : 'Ready: choose a subsystem',
    OPENING: `Opening: ${NAMES[st.id]}`, SHOWN: `On display: ${NAMES[st.id]}`,
    CLOSING: st.queued ? `Returning, then ${NAMES[st.queued]}` : 'Returning home', RUN: 'Running: treadle → pitman → crank → belt → needle',
  }[st.mode];
  $('#mode-text').textContent = st.tour && st.mode !== 'IDLE' ? `${text} · touring` : text;
  $('#mode-dot').className = 'dot ' + st.mode.toLowerCase();
  if (st.mode === 'SHOWN') setTimeout(() => showPanel(st.id), (CFG.PANEL_DELAY) * 1000);
  else panel.classList.remove('on');
}
function onHover(id) {
  $('#hover-text').textContent = id ? `Click: ${id === 'reset' || id === 'run' ? NAMES[id] : 'Inspect ' + NAMES[id]}` : 'Drag to orbit · scroll to zoom · click a brass button';
}
try {
  viewer = await boot({canvas: $('#view'), onState, onHover});
} catch (e) {
  console.error(e);
  $('#mode-text').textContent = 'WebGL is not available in this browser: the screenshots below show the exhibit.';
}
const press = (id) => viewer && viewer.press(id);
document.addEventListener('click', (e) => {
  const k = e.target.closest('[data-id]');
  if (k && k.classList.contains('key')) press(k.dataset.id);
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); press(g.dataset.go); $('#exhibit').scrollIntoView({behavior: 'smooth'}); }
  const c = e.target.closest('[data-cam]');
  if (c && viewer) viewer.setCam(c.dataset.cam);
});
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  const n = '1234567890'.indexOf(e.key);
  if (n >= 0) press(SUBS[n].id);
  else if (e.key === 'r' || e.key === 'R') press('reset');
  else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); press('run'); }
});

// ---------------------------------------------------------------- screenshots (manifest written by the capture script)
fetch('screenshots/manifest.json').then((r) => (r.ok ? r.json() : [])).then((list) => {
  $('#shots').innerHTML = list.map((s) => `
    <figure><a href="screenshots/${s.file}"><img src="screenshots/${s.file}" alt="${esc(s.caption)}" loading="lazy"></a>
    <figcaption>${esc(s.caption)}</figcaption></figure>`).join('') || '<p class="small">No screenshots yet.</p>';
}).catch(() => {});

// ---------------------------------------------------------------- test report
fetch('assets/test-report.json').then((r) => (r.ok ? r.json() : null)).then((rep) => {
  if (!rep) return;
  const ok = rep.checks.filter((c) => c.ok).length;
  const threaded = Object.entries(rep.contacts).filter(([, c]) => Object.values(c).some((v) => Object.keys(v).length));
  $('#contacts').innerHTML = `<p><strong>${ok} / ${rep.checks.length} checks pass</strong> in the latest build. Contacts along withdrawal paths happen only where parts are physically threaded together (thread through the needle and lever eyes, the belt in its grooves and table holes, pins in the pitman's sockets): ${threaded.length} of 16 paths, never during presentation.</p>`;
}).catch(() => {});

// ---------------------------------------------------------------- changelog + roadmap (straight from the repo)
function md(text, maxItems) {
  const out = [];
  let n = 0;
  for (const line of text.split('\n')) {
    if (/^## /.test(line)) { if (n >= maxItems) break; out.push(`<h4>${esc(line.slice(3))}</h4>`); n++; }
    else if (/^\s*[-*] /.test(line)) out.push(`<li>${esc(line.replace(/^\s*[-*] /, '')).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</li>`);
  }
  return out.join('').replace(/(<li>.*?<\/li>)+/g, (m) => `<ul>${m}</ul>`);
}
for (const [file, el, max] of [['CHANGELOG.md', '#changelog', 2], ['ROADMAP.md', '#roadmap', 3]]) {
  fetch('assets/' + file).then((r) => (r.ok ? r.text() : fetch(REPO_RAW + file).then((x) => x.text())))
    .then((t) => { $(el).innerHTML = md(t, max); }).catch(() => {});
}
