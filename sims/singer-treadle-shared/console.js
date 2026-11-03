// The overlay: a fixed 1600 x 900 CSS layout (the stage scales it to the window). Live numbers left, the stitch-cycle strip
// on top, the part card on the right, the brass console plate along the bottom with sixteen numbered buttons, callouts
// with thin leaders into the machine, captions for the tour and the film. Presentation only: the page drives it.
import {SUBSYSTEMS, BY_ID, IDS, BUTTON_KEYS} from './subsystems.js';
import {DIM, RATIO_LABEL} from './kin.js';

export const C = {ink: '#16181b', mute: '#7d8187', faint: '#c9ccd0', line: '#e1e3e6', panel: 'rgba(248,248,249,.95)', red: '#d6182b', brass: '#c9a24f', brassDark: '#8f6d2a', grey: '#5d6670'};
export const SPM_MAX = 900;

const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.sg{position:absolute;inset:0;pointer-events:none}
.sg *{box-sizing:border-box}
.sg .pn{position:absolute;background:${C.panel};border:1px solid ${C.line};box-shadow:0 1px 2px rgba(20,22,26,.05)}
.sg .cp{font-size:9.4px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap}
.sg .mu{color:${C.mute}}
.sg .row{position:absolute;left:0;right:0;display:flex;justify-content:space-between;align-items:baseline;font-size:11px;padding:0 0 4px}
.sg .row b{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:11px}
.sg .row span{font-size:8.6px;letter-spacing:1.2px;text-transform:uppercase;color:${C.mute};font-weight:600}
.sg .plate{position:absolute;left:35px;top:706px;width:1530px;height:180px;background:linear-gradient(180deg,#e7cf8f 0%,${C.brass} 45%,#b48b3c 100%);border:1px solid ${C.brassDark};box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 2px 6px rgba(60,40,10,.18)}
.sg .plate:before{content:'';position:absolute;inset:6px;border:1px dashed rgba(90,60,15,.35)}
.sg .key{position:absolute;width:86px;height:40px;background:#fbfbfb;border:1px solid ${C.brassDark};box-shadow:0 1px 1px rgba(0,0,0,.15);display:flex;flex-direction:column;align-items:flex-start;justify-content:center;padding:0 0 0 8px;cursor:pointer;pointer-events:auto;transition:background .18s,border-color .18s}
.sg .key i{font-style:normal;font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;line-height:1}
.sg .key em{font-style:normal;font-size:7.6px;letter-spacing:1.1px;font-weight:700;color:${C.ink};margin-top:3px;white-space:nowrap}
.sg .key kbd{position:absolute;right:5px;top:4px;font:600 7.6px 'JetBrains Mono',monospace;color:${C.mute}}
.sg .key:hover{background:#fff;border-color:${C.red}}
.sg .key.on{background:${C.ink};border-color:${C.ink}}
.sg .key.on i,.sg .key.on em,.sg .key.on kbd{color:#fff}
.sg .key.hov{border-color:${C.red};box-shadow:0 0 0 2px rgba(214,24,43,.35)}
.sg .btn{position:absolute;height:28px;padding:0 10px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;border:1px solid ${C.brassDark};background:#fbfbfb;color:${C.ink};cursor:pointer;pointer-events:auto;white-space:nowrap;user-select:none}
.sg .btn:hover{border-color:${C.red}}
.sg .btn.on{background:${C.red};border-color:${C.red};color:#fff}
.sg .slide{position:absolute;height:26px;pointer-events:auto;cursor:ew-resize}
.sg .slide .trk{position:absolute;left:0;right:0;top:12px;height:2px;background:${C.brassDark};opacity:.55}
.sg .slide .knob{position:absolute;top:4px;width:9px;height:18px;margin-left:-4.5px;background:${C.ink}}
.sg .card{position:absolute;left:1270px;top:34px;width:295px;background:${C.panel};border:1px solid ${C.line};padding:16px 16px 14px}
.sg .card .no{font:700 44px/1 'JetBrains Mono',monospace;color:${C.red};letter-spacing:-1px}
.sg .card h2{margin:8px 0 2px;font-size:20px;font-weight:700;letter-spacing:-.2px}
.sg .card .hint{font-size:8.8px;letter-spacing:1.3px;text-transform:uppercase;color:${C.mute};font-weight:600}
.sg .card p{margin:10px 0 0;font-size:11.2px;line-height:1.5;color:#2b2e33}
.sg .card .lab{margin-top:12px;font-size:8.6px;letter-spacing:1.4px;text-transform:uppercase;color:${C.mute};font-weight:700}
.sg .chips{margin-top:6px;display:flex;flex-wrap:wrap;gap:4px}
.sg .chips span{font-size:9px;font-weight:600;padding:3px 6px;border:1px solid ${C.line};background:#fff;cursor:pointer;pointer-events:auto}
.sg .chips span:hover{border-color:${C.red}}
.sg .fact{margin-top:10px;font-size:10px;line-height:1.5;color:${C.grey};border-top:1px solid ${C.line};padding-top:9px}
.sg .index{position:absolute;left:1270px;top:34px;width:295px;background:${C.panel};border:1px solid ${C.line};padding:14px 16px}
.sg .index div{display:flex;gap:9px;align-items:baseline;font-size:10.5px;height:17px;cursor:pointer;pointer-events:auto}
.sg .index div b{font-family:'JetBrains Mono',monospace;color:${C.red};width:20px}
.sg .index div:hover{color:${C.red}}
.sg .call{position:absolute;white-space:nowrap;transform:translate(-50%,-100%)}
.sg .call b{display:block;font-size:11px;font-weight:600;background:rgba(255,255,255,.92);padding:1px 4px;border-left:2px solid ${C.red}}
.sg .call span{display:block;font-size:8px;letter-spacing:1.1px;color:${C.mute};text-transform:uppercase;background:rgba(255,255,255,.92);padding:0 4px 1px;margin-left:0}
.sg .cap{position:absolute;left:0;right:0;top:618px;text-align:center}
.sg .cap b{display:inline-block;font-size:21px;font-weight:700;letter-spacing:-.2px;background:rgba(255,255,255,.9);padding:4px 12px 2px;border:1px solid ${C.line}}
.sg .cap span{display:block;margin-top:4px;font-size:11px;color:#2b2e33}
.sg .cap span b{font-size:11px}
.sg .tourchip{position:absolute;left:800px;top:20px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:21px;padding:0 11px;border:1px solid ${C.line};background:rgba(255,255,255,.95);font:600 8.6px Inter,sans-serif;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.sg .tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:${C.red}}
.sg .tourchip.on i{animation:sgblink 1.2s steps(2) infinite}
@keyframes sgblink{50%{opacity:.15}}
.sg .hint{position:absolute;left:50%;top:684px;transform:translateX(-50%);white-space:nowrap;padding:3px 10px;background:rgba(255,255,255,.9);border:1px solid ${C.line};font-size:8.4px;letter-spacing:1.3px;color:${C.grey};text-transform:uppercase;font-weight:600}
.sg .strip{position:absolute;left:380px;top:34px;width:830px;height:150px;background:${C.panel};border:1px solid ${C.line}}
`;

const TOP_KEYS = BUTTON_KEYS;
const el = (html) => {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild;
};
const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : '–');

/** Builds the overlay into `app`; returns the handles the page needs. */
export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = el(`<div class="sg"></div>`);
  app.appendChild(root);
  const add = (h) => {
    const n = el(h);
    root.appendChild(n);
    return n;
  };

  // ---------------------------------------------------------- title and the headline number
  add(`<div style="position:absolute;left:35px;top:34px;width:43px;height:3px;background:${C.red}"></div>`);
  add(`<div style="position:absolute;left:35px;top:48px;font-size:24px;font-weight:700;letter-spacing:-.3px">Singer Treadle <span style="color:${C.red}">·</span> Teardown</div>`);
  add(`<div class="cp mu" style="position:absolute;left:35px;top:82px;font-weight:500;letter-spacing:1.6px;font-size:8.8px">c. 1880–1915 &nbsp;•&nbsp; VIBRATING SHUTTLE &nbsp;•&nbsp; BELT DRIVE, 2.31 : 1</div>`);
  const spm = add(`<div style="position:absolute;left:33px;top:104px;font:800 54px/1 'JetBrains Mono',monospace;letter-spacing:-2px;color:${C.red}"></div>`);
  add(`<div class="cp mu" style="position:absolute;left:35px;top:164px;font-weight:600;font-size:8.6px">STITCHES A MINUTE</div>`);
  const stitchCount = add(`<div class="cp" style="position:absolute;left:230px;top:112px;font-weight:700;font-size:9px;text-align:right;width:70px"></div>`);

  // ---------------------------------------------------------- the chain (left)
  const chain = add(`<div class="pn" style="left:35px;top:196px;width:262px;height:238px"></div>`);
  add(`<div class="cp" style="position:absolute;left:47px;top:208px;font-weight:700">THE CHAIN</div>`);
  add(`<div class="cp mu" style="position:absolute;left:47px;top:221px;font-size:8px;text-transform:none;letter-spacing:.2px">treadle → pitman → band wheel → belt → balance wheel → arm shaft</div>`);
  const rows = {};
  const rowDefs = [
    ['treadle', 'Treadle angle', '°'],
    ['band', 'Band wheel', 'rpm'],
    ['hand', 'Balance wheel', 'rpm'],
    ['ratio', 'Belt ratio', 'band : balance'],
    ['belt', 'Belt speed', 'm/s'],
  ];
  rowDefs.forEach(([k, label, unit], i) => {
    const r = add(`<div class="row" style="left:47px;top:${246 + i * 38}px;width:238px"><span>${label}</span><b data-k="${k}"></b></div>`);
    rows[k] = r.querySelector('b');
    add(`<div style="position:absolute;left:47px;top:${266 + i * 38}px;width:238px;height:1px;background:${C.line}"></div>`);
  });
  const dataRow = (k) => rows[k];

  // ---------------------------------------------------------- the stitch (left, lower)
  add(`<div class="pn" style="left:35px;top:446px;width:262px;height:226px"></div>`);
  add(`<div class="cp" style="position:absolute;left:47px;top:458px;font-weight:700">THE STITCH</div>`);
  const stitchRows = {};
  const stitchDefs = [
    ['needle', 'Needle bar', 'mm above plate'],
    ['take', 'Take-up lever', '°'],
    ['shuttle', 'Shuttle phase', '°'],
    ['feed', 'Feed dog phase', '°'],
    ['len', 'Stitch length', 'mm'],
    ['count', 'Stitch count', ''],
    ['tens', 'Thread tension', '/ 10'],
  ];
  stitchDefs.forEach(([k, label], i) => {
    const r = add(`<div class="row" style="left:47px;top:${482 + i * 26}px;width:238px"><span>${label}</span><b data-k="${k}"></b></div>`);
    stitchRows[k] = r.querySelector('b');
  });

  // ---------------------------------------------------------- the stitch-cycle strip (top centre)
  add(`<div class="strip"></div>`);
  add(`<div class="cp" style="position:absolute;left:392px;top:44px;font-weight:700">ONE STITCH · ONE TURN OF THE BALANCE WHEEL</div>`);
  const strip = add(`<svg style="position:absolute;left:386px;top:62px" width="818" height="118"></svg>`);
  add(`<div class="cp mu" style="position:absolute;left:760px;top:44px;font-weight:500;font-size:8px;width:440px;text-align:right">
    <span style="color:${C.ink}">—</span> NEEDLE &nbsp; <span style="color:${C.red}">—</span> TAKE-UP &nbsp; <span style="color:${C.grey}">—</span> SHUTTLE &nbsp; <span style="color:${C.brassDark}">—</span> FEED DOG</div>`);

  // ---------------------------------------------------------- the part card (right)
  const card = add(`<div class="card" style="display:none"></div>`);
  const index = add(`<div class="index"></div>`);
  index.innerHTML = `<div class="cp" style="margin-bottom:10px;font-weight:700">THE SIXTEEN PARTS</div>` + SUBSYSTEMS.map((s, i) => `<div data-idx="${s.id}"><b>${s.n}</b>${s.name}</div>`).join('') + `<div style="margin-top:10px;font-size:9.5px;color:${C.mute};line-height:1.5">Press a number to bring that part forward. Drag the machine to orbit; scroll to zoom.</div>`;

  // ---------------------------------------------------------- callouts (SVG leaders and labels) and the captions
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const cap = add(`<div class="cap" style="display:none"></div>`);
  const tourChip = add(`<div class="tourchip" style="display:none"></div>`);
  const hint = add(`<div class="hint"></div>`);

  // ---------------------------------------------------------- the brass console plate
  add(`<div class="plate"></div>`);
  const keys = {};
  const keyX = 52;
  const keyW = 86;
  const keyGap = 5;
  SUBSYSTEMS.forEach((s, i) => {
    const k = el(`<div class="key" data-id="${s.id}" style="left:${keyX + i * (keyW + keyGap)}px;top:718px"><i>${String(s.n).padStart(2, '0')}</i><em>${s.button}</em><kbd>${TOP_KEYS[i]}</kbd></div>`);
    root.appendChild(k);
    keys[s.id] = k;
  });
  const btn = {};
  const bstyle = (x, y, w, h = 28) => `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
  btn.run = add(`<div class="btn" style="${bstyle(52, 806, 118)}">▶&nbsp; RUN</div>`);
  btn.pump = add(`<div class="btn" style="${bstyle(176, 806, 118)}">PUMP · HOLD</div>`);
  btn.reset = add(`<div class="btn" style="${bstyle(300, 806, 118)}">RESET</div>`);
  btn.lift = add(`<div class="btn" style="${bstyle(424, 806, 146)}">PRESSER · DOWN</div>`);
  btn.tour = add(`<div class="btn" style="${bstyle(576, 806, 118)}">AUTO TOUR</div>`);
  add(`<div class="cp" style="position:absolute;left:52px;top:786px;font-size:8px;color:${C.ink};font-weight:700">MACHINE</div>`);
  add(`<div class="cp" style="position:absolute;left:720px;top:786px;font-size:8px;color:${C.ink};font-weight:700">SPEED · 0–900 STITCHES A MINUTE</div>`);
  add(`<div class="cp" style="position:absolute;left:1080px;top:786px;font-size:8px;color:${C.ink};font-weight:700">STITCH LENGTH · 0–4 MM</div>`);
  const spd = add(`<div class="slide" style="left:720px;top:806px;width:330px"><div class="trk"></div><div class="knob"></div></div>`);
  const len = add(`<div class="slide" style="left:1080px;top:806px;width:330px"><div class="trk"></div><div class="knob"></div></div>`);
  const spdVal = add(`<div class="cp" style="position:absolute;left:1062px;top:786px;font-size:8px;color:${C.ink};font-weight:700;display:none"></div>`);
  const lenVal = add(`<div class="cp" style="position:absolute;left:1420px;top:786px;font-size:8px;color:${C.ink};font-weight:700"></div>`);
  const spdTxt = add(`<div class="cp" style="position:absolute;left:1420px;top:786px;font-size:8px;color:${C.ink};font-weight:700;display:none"></div>`);
  // the order of the plate's titles is fixed; values are written in update()
  const spdKnob = spd.querySelector('.knob');
  const lenKnob = len.querySelector('.knob');

  // ---------------------------------------------------------- helpers for the strip
  const X = (deg) => (deg / 360) * 790 + 14;
  const Y = (v, lo, hi) => 100 - ((v - lo) / (hi - lo)) * 88;
  let stripBuilt = false;
  function buildStrip(curves) {
    const parts = [];
    // zero lines and the four traces, from the solver's curves
    parts.push(`<line x1="14" x2="804" y1="${Y(0, -2, 6)}" y2="${Y(0, -2, 6)}" stroke="${C.faint}" stroke-width="1"/>`);
    for (let d = 0; d <= 360; d += 90) parts.push(`<line x1="${X(d)}" x2="${X(d)}" y1="8" y2="106" stroke="${C.line}"/><text x="${X(d)}" y="116" font-size="8.5" text-anchor="middle" fill="${C.mute}">${d}°</text>`);
    const path = (vals, f, col, w = 1.4, dash = '') =>
      `<path d="${vals.map((v, i) => `${i ? 'L' : 'M'}${X((i / vals.length) * 360).toFixed(1)} ${f(v).toFixed(1)}`).join('')}" fill="none" stroke="${col}" stroke-width="${w}" ${dash}/>`;
    const needleN = curves.needleMM.map((v) => v);
    parts.push(path(needleN, (v) => Y(v, -12, 22), C.ink, 1.5));
    parts.push(path(curves.takeupDeg, (v) => Y(v, -40, 40), C.red, 1.5));
    parts.push(path(curves.shuttleDeg, (v) => Y(v, -40, 40), C.grey, 1.3, 'stroke-dasharray="3 2"'));
    parts.push(path(curves.feedZ, (v) => Y(v * 1000, -2.6, 2.6), C.brassDark, 1.3));
    // the cursor: moved by attribute each frame, so the static curves are drawn once
    parts.push(`<line class="cl" x1="14" x2="14" y1="8" y2="106" stroke="${C.red}" stroke-width="1.6"/><circle class="cd" cx="14" cy="${Y(0, -12, 22)}" r="3" fill="${C.red}"/>`);
    return parts.join('');
  }
  let cursorLine = null;
  let cursorDot = null;
  const setStrip = (curves) => {
    strip.innerHTML = buildStrip(curves);
    cursorLine = strip.querySelector('.cl');
    cursorDot = strip.querySelector('.cd');
    stripBuilt = true;
  };

  // ---------------------------------------------------------- the update: every number on the screen from one frame's state
  let lastCurves = null;
  function update(f) {
    const n = f.sol.numbers;
    spm.textContent = String(Math.round(n.stitchesPerMin));
    stitchCount.textContent = `COUNT ${n.stitchCount}`;
    rows.treadle.textContent = `${n.treadleDeg >= 0 ? '+' : '−'}${fmt(Math.abs(n.treadleDeg), 1)}`;
    rows.band.textContent = fmt(n.bandRpm, 0);
    rows.hand.textContent = fmt(n.handRpm, 0);
    rows.ratio.textContent = `${RATIO_LABEL} : 1`;
    rows.belt.textContent = fmt(n.beltSpeed, 2);
    stitchRows.needle.textContent = fmt(n.needleMM, 1);
    stitchRows.take.textContent = fmt(n.takeupDeg, 0);
    stitchRows.shuttle.textContent = fmt(n.shuttlePhaseDeg, 0);
    stitchRows.feed.textContent = fmt(n.feedPhaseDeg, 0);
    stitchRows.len.textContent = fmt(n.stitchMM, 1);
    stitchRows.count.textContent = String(n.stitchCount);
    stitchRows.tens.textContent = fmt(n.tension10, 1);

    // controls
    const spdK = Math.min(1, f.spm / SPM_MAX);
    spdKnob.style.left = `${spdK * 330}px`;
    lenKnob.style.left = `${Math.min(1, f.stitchMM / 4) * 330}px`;
    lenVal.textContent = `${fmt(f.stitchMM, 1)} MM`;
    btn.run.innerHTML = f.running ? '❚❚&nbsp; PAUSE' : '▶&nbsp; RUN';
    btn.run.classList.toggle('on', !!f.running);
    btn.pump.classList.toggle('on', !!f.pumping);
    btn.lift.textContent = f.presserUp > 0.5 ? 'PRESSER · UP' : 'PRESSER · DOWN';
    btn.lift.classList.toggle('on', f.presserUp > 0.5);
    btn.tour.textContent = f.tour ? 'TOURING · PRESS ANY KEY' : 'AUTO TOUR';
    btn.tour.classList.toggle('on', !!f.tour);
    tourChip.style.display = f.tour ? 'flex' : 'none';

    // keys: the open one lit; the hovered one outlined
    for (const s of SUBSYSTEMS) {
      keys[s.id].classList.toggle('on', f.openId === s.id);
      keys[s.id].classList.toggle('hov', f.hoverId === s.id);
    }

    // the part card: the presented part, else the index
    const open = f.openId ? BY_ID[f.openId] : null;
    if (open && f.openP > 0.02) {
      card.style.display = 'block';
      index.style.display = 'none';
      card.innerHTML = `
        <div class="no">${String(open.n).padStart(2, '0')}</div>
        <h2>${open.name}</h2>
        <div class="hint">${open.hint}</div>
        <p>${open.text}</p>
        <div class="lab">Connected to</div>
        <div class="chips">${open.connects.map((c) => `<span data-go="${c}">${BY_ID[c].name}</span>`).join('')}</div>
        <div class="fact"><b style="font-weight:700;color:${C.ink}">Period fact.</b> ${open.fact}</div>`;
      card.querySelectorAll('[data-go]').forEach((c) => c.dataset.go && (c.onclick = () => f.onGo?.(c.dataset.go)));
    } else {
      card.style.display = 'none';
      index.style.display = 'block';
    }

    // the timing strip: the curves (computed once per page) and the cursor at this phase
    if (!stripBuilt && f.curves) setStrip(f.curves);
    const ph = ((f.sol.theta % 360) + 360) % 360;
    const cx = X(ph).toFixed(2);
    cursorLine?.setAttribute('x1', cx);
    cursorLine?.setAttribute('x2', cx);
    cursorDot?.setAttribute('cx', cx);
    cursorDot?.setAttribute('cy', Y(f.sol.needle.mm, -12, 22).toFixed(2));

    // callouts: leaders from the presented part into the machine
    let lh = '';
    let ch = '';
    const o = f.openP > 0.6 ? open : null;
    if (o && f.callouts) {
      // label positions: each beside its anchor, then pushed apart so no two labels overlap (34 px minimum)
      const placed = f.callouts.map((c, i) => {
        const [ax, ay] = c.at;
        const side = ax < 800 ? -1 : 1;
        return {c, i, ax, ay, side, lbX: Math.min(1180, Math.max(340, ax + side * (120 + i * 6))), lbY: Math.max(140, Math.min(560, ay - 40 + i * 58))};
      }).filter((p) => p.c.at);
      placed.sort((a, b) => a.lbY - b.lbY);
      for (let k = 1; k < placed.length; k++) placed[k].lbY = Math.max(placed[k].lbY, placed[k - 1].lbY + 34);
      placed.forEach(({c, i, ax, ay, side, lbX, lbY}) => {
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${(lbX - side * 6).toFixed(1)},${(lbY + 14).toFixed(1)} ${lbX.toFixed(1)},${(lbY + 14).toFixed(1)}" fill="none" stroke="${C.ink}" stroke-width=".9" opacity=".7"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.6" fill="${C.red}"/>`;
        ch += `<div class="call" style="left:${lbX.toFixed(1)}px;top:${(lbY + 12).toFixed(1)}px;opacity:${Math.min(1, f.openP).toFixed(2)};transform:translate(${side < 0 ? '0' : '-100%'},-100%)"><b>${c.label}</b><span>${c.sub}</span></div>`;
      });
    }
    callSvg.innerHTML = lh;
    callG.innerHTML = ch;

    // captions for the film and the tour
    if (f.caption) {
      cap.style.display = 'block';
      cap.style.opacity = String(f.caption.opacity ?? 1);
      cap.innerHTML = `<b>${f.caption.head}</b><span>${f.caption.sub}</span>`;
    } else cap.style.display = 'none';

    hint.textContent = f.hintText || '';
  }

  // the buttons and the plate's hit areas are wired by the page through the returned handles
  return {
    root,
    keys,
    btn,
    spd,
    len,
    index,
    card,
    strip,
    update,
    buildStrip: setStrip,
    setSpeed: (k) => (spdKnob.style.left = `${k * 330}px`),
    tourChip,
    cap,
    hint,
    lastCurves,
    dataRow,
  };
}
