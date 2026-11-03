// The machine as a page you drive. A fixed-step simulation (1/120 s) advances the balance wheel; the presenter's event log
// decides which part is on display; the idle tour plays the shared script until the first input, which hands control over
// at once. Every number on screen comes from solve() on the same state, and the whole run is deterministic: the same
// inputs at the same simulated times give the same motion.
import * as THREE from 'three';
import {createStage} from './stage.js';
import {createMachine} from './machine.js';
import {createConsole, SPM_MAX} from './console.js';
import {solve, cycleCurves, DIM} from './kin.js';
import {SUBSYSTEMS, BY_ID, BUTTON_KEYS, IDS, DISPLAY, OVERVIEW} from './subsystems.js';
import {stateAt, build} from './presenter.js';
import {TOUR_EVENTS, TOUR_CAPTIONS, TOUR_DURATION, TOUR_RPM, advance, rpmTargetAt, captionAt, overviewAz} from './script.js';
import {makeMaterials} from './materials.js';

export const W = 1600;
export const H = 900;
export const STEP = 1 / 120; // the simulation's fixed step, seconds
export const IDLE_DEFAULT = 25; // seconds of quiet before the tour takes over the page

const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};

const CSS = `
html,body{margin:0;height:100%;background:#ecedef;overflow:hidden;touch-action:none}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{position:absolute;left:0;top:0;width:${W}px;height:${H}px;display:block;cursor:grab}
#gl.drag{cursor:grabbing}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#8b8f95;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
`;

const QUALITY = [
  {ao: true, pr: 2, shadow: 2048},
  {ao: false, pr: 1.5, shadow: 2048},
  {ao: false, pr: 1, shadow: 1024},
];

/**
 * The camera for a presenter state and the user's orbit: the overview, or the presented part's view, blended by progress.
 * A moved part is framed by its size: its largest dimension, after its presentation scale, fills about half the height.
 */
export function cameraFor(state, orbit, t = 0, touring = false, sizes = {}) {
  const az0 = touring ? overviewAz(t) : OVERVIEW.az;
  const ov = {target: OVERVIEW.t, az: az0 + orbit.az, el: OVERVIEW.el + orbit.el, d: OVERVIEW.d * orbit.zoom};
  if (!state.id || state.p <= 0) return ov;
  const part = BY_ID[state.id];
  const c = part.cam;
  const framed = part.mode === 'move' && sizes[state.id] ? clamp(3.9 * sizes[state.id] * part.scale, 0.5, 2.8) : c.d;
  const op = {target: c.t, az: c.az + orbit.az, el: c.el + orbit.el, d: framed * orbit.zoom};
  const e = clamp(state.p, 0, 1);
  const mix = (a, b) => a + (b - a) * e;
  return {
    target: [mix(ov.target[0], op.target[0]), mix(ov.target[1], op.target[1]), mix(ov.target[2], op.target[2])],
    az: mix(ov.az, op.az),
    el: mix(ov.el, op.el),
    d: mix(ov.d, op.d),
  };
}

export async function runLive({idle = IDLE_DEFAULT, tour: startTour = true} = {}) {
  const top = 0;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = 'Turn your phone sideways for the full console';
  document.body.appendChild(note);

  const stage = createStage(canvas, {view: {width: W, height: H}});
  const M = makeMaterials();
  const machine = createMachine(M);
  stage.scene.add(machine.root);
  const ui = createConsole(app);
  const curves = cycleCurves(360, DIM.feed.S);
  ui.buildStrip(curves);
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;

  // ---------------------------------------------------------- the state
  const S = {
    t: 0, // simulated seconds
    theta: 0, // balance wheel, degrees (unwrapped)
    rpm: 0, // balance wheel's speed now
    target: 0, // the speed the operator asks for (stitches a minute)
    lastSpeed: 300,
    pumping: false,
    homing: false,
    stitchMM: DIM.feed.S,
    presserUp: 0,
    presserTarget: 0,
    tension: 0.5,
    scrub: null,
  };
  const live = {initial: {id: null, p: 0}, events: []};
  const tour = {on: false, t0: 0, enabled: startTour};
  const orbit = {az: 0, el: 0, zoom: 1};
  let hoverId = null;
  let hoverGroup = null;
  let hover = null;
  let idleFor = 0;
  let quality = light ? 2 : 0;
  let shownOnce = false;
  let scale = 1;
  let shifted = 0;

  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };
  const fit = () => {
    scale = Math.min(innerWidth / W, (innerHeight - top) / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${top + ((innerHeight - top) - H * scale) / 2}px) scale(${scale})`;
    const pr = clamp((devicePixelRatio || 1) * scale, 0.75, QUALITY[quality].pr);
    stage.resize(W, H, pr);
  };
  const applyQuality = () => {
    stage.setQuality({ao: QUALITY[quality].ao, shadow: QUALITY[quality].shadow});
    fit();
  };
  applyQuality();
  addEventListener('resize', fit);

  // ---------------------------------------------------------- the presenter, live and the tour
  // the tour's own clock: it loops over its script
  const tourT = () => (S.t - tour.t0) % TOUR_DURATION;
  const presentNow = () => {
    if (tour.on) return stateAt(tourT(), TOUR_EVENTS, {id: null, p: 0});
    return stateAt(S.t, live.events, live.initial);
  };
  const touch = () => {
    idleFor = 0;
    if (tour.on) takeOver();
  };
  const takeOver = () => {
    if (!tour.on) return;
    const st = stateAt(tourT(), TOUR_EVENTS, {id: null, p: 0});
    tour.on = false;
    live.initial = {id: st.id ?? null, p: st.p ?? 0};
    live.events = [];
    // keep the speed the tour had reached: the wheel carries on from there, no jump
    S.target = rpmTargetAt(tourT(), TOUR_RPM);
    S.presserTarget = 0;
    orbit.az = 0;
    orbit.el = 0;
  };
  const startTourNow = () => {
    if (!tour.enabled) return;
    tour.on = true;
    tour.t0 = S.t;
    S.homing = false;
    orbit.az = 0;
    orbit.el = 0;
    orbit.zoom = 1;
    live.events = [];
  };
  const emit = (e) => {
    touch();
    live.events.push({...e, t: S.t});
  };
  const openPart = (id) => {
    touch();
    const cur = presentNow();
    if (cur.id === id && cur.p >= 0.999) emit({type: 'close'});
    else emit({type: 'open', id});
  };
  const resetAll = () => {
    touch();
    emit({type: 'reset'});
    S.target = 0;
    S.presserTarget = 0;
    S.stitchMM = DIM.feed.S;
    S.homing = true;
    orbit.az = 0;
    orbit.el = 0;
    orbit.zoom = 1;
  };

  // ---------------------------------------------------------- the controls
  for (const id of IDS) {
    ui.keys[id].addEventListener('click', () => openPart(id));
    ui.keys[id].addEventListener('pointerenter', () => (hoverId = id));
    ui.keys[id].addEventListener('pointerleave', () => (hoverId = null));
  }
  ui.index.querySelectorAll('[data-idx]').forEach((n) => {
    n.style.pointerEvents = 'auto';
    n.addEventListener('click', () => openPart(n.dataset.idx));
    n.addEventListener('pointerenter', () => (hoverId = n.dataset.idx));
    n.addEventListener('pointerleave', () => (hoverId = null));
  });
  ui.btn.run.addEventListener('click', () => {
    touch();
    S.target = S.target > 0 ? 0 : S.lastSpeed;
    S.homing = false;
  });
  ui.btn.reset.addEventListener('click', resetAll);
  ui.btn.lift.addEventListener('click', () => {
    touch();
    S.presserTarget = S.presserTarget > 0.5 ? 0 : 1;
  });
  ui.btn.tour.addEventListener('click', () => {
    if (tour.on) takeOver();
    else startTourNow();
  });
  ui.btn.pump.style.pointerEvents = 'auto';
  ui.btn.pump.addEventListener('pointerdown', () => {
    touch();
    S.pumping = true;
    ui.btn.pump.setPointerCapture?.(1);
  });
  ui.btn.pump.addEventListener('pointerup', () => (S.pumping = false));
  ui.btn.pump.addEventListener('pointercancel', () => (S.pumping = false));
  ui.btn.pump.addEventListener('pointerleave', () => (S.pumping = false));
  ui.tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (tour.on) takeOver();
    else startTourNow();
  });

  // sliders: drag along their tracks
  const slider = (node, apply) => {
    const move = (e) => {
      const r = node.getBoundingClientRect();
      const k = clamp((e.clientX - r.left) / scale / 330, 0, 1);
      apply(k);
      touch();
    };
    node.addEventListener('pointerdown', (e) => {
      node.setPointerCapture?.(e.pointerId);
      move(e);
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
    });
  };
  slider(ui.spd, (k) => {
    S.target = Math.round(k * SPM_MAX);
    if (S.target > 0) S.lastSpeed = S.target;
    S.homing = false;
  });
  slider(ui.len, (k) => (S.stitchMM = Math.round(k * 4 * 10) / 10));

  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const i = BUTTON_KEYS.indexOf(key);
    if (i >= 0) {
      e.preventDefault();
      openPart(IDS[i]);
      return;
    }
    if (key === ' ') {
      e.preventDefault();
      touch();
      S.target = S.target > 0 ? 0 : S.lastSpeed;
      S.homing = false;
    } else if (key === 'r' || key === 'escape') {
      e.preventDefault();
      resetAll();
    } else if (key === 'l') {
      touch();
      S.presserTarget = S.presserTarget > 0.5 ? 0 : 1;
    } else if (key === 'p') {
      touch();
      S.pumping = true;
    } else if (key === 'arrowleft' || key === 'arrowright') {
      e.preventDefault();
      touch();
      S.theta += (key === 'arrowright' ? 1 : -1) * 15;
      S.target = 0;
      S.rpm = 0;
    } else {
      touch();
    }
  });
  addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() === 'p') S.pumping = false;
  });

  // orbit and zoom on the canvas; the hand wheel scrubs the stitch when you drag on it
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickGroup = (x, y) => {
    ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
    raycaster.setFromCamera(ndc, stage.camera);
    const hits = raycaster.intersectObjects(machine.root.children, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData?.id) o = o.parent;
      if (o) return o.userData.id;
    }
    return null;
  };
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = toStage(e.clientX, e.clientY);
    touch();
    const id = pickGroup(x, y);
    if (id === 'drive_wheel') {
      S.scrub = {x: e.clientX};
      S.target = 0;
      S.rpm = 0;
      S.homing = false;
    } else {
      drag = {x: e.clientX, y: e.clientY};
      canvas.classList.add('drag');
    }
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = toStage(e.clientX, e.clientY);
    if (S.scrub) {
      S.theta += (e.clientX - S.scrub.x) / scale * 0.9;
      S.scrub.x = e.clientX;
      touch();
      return;
    }
    if (drag) {
      orbit.az += ((e.clientX - drag.x) / scale) * 0.3;
      orbit.el = clamp(orbit.el + ((e.clientY - drag.y) / scale) * 0.2, -15, 40);
      drag = {x: e.clientX, y: e.clientY};
      touch();
      return;
    }
    hoverId = pickGroup(x, y);
  });
  const endDrag = () => {
    drag = null;
    S.scrub = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      touch();
      orbit.zoom = clamp(orbit.zoom * Math.exp(e.deltaY * 0.0012), 0.5, 2.2);
    },
    {passive: false},
  );

  // ---------------------------------------------------------- the fixed step
  const step = (h) => {
    S.t += h;
    // quiet for `idle` seconds hands the page to the tour; any input resets the count (touch())
    if (!tour.on && tour.enabled) {
      idleFor += h;
      if (idleFor > idle) startTourNow();
    }
    // the speed: the tour's script, or the operator's target; pumping lifts it while held
    let target = tour.on ? rpmTargetAt(tourT(), TOUR_RPM) : S.target;
    if (S.pumping) target = Math.max(target, 600);
    if (S.homing) target = 0;
    const a = advance({theta: S.theta, rpm: S.rpm}, h, target);
    S.theta = a.theta;
    S.rpm = a.rpm;
    if (S.homing && S.rpm < 0.5) {
      // the balance wheel settles on the nearest home angle, then stops
      const home = Math.round(S.theta / 360) * 360;
      S.theta += (home - S.theta) * (1 - Math.exp(-h / 0.25));
      if (Math.abs(home - S.theta) < 1e-4) {
        S.theta = home;
        S.homing = false;
        S.rpm = 0;
      }
    }
    S.presserUp += (S.presserTarget - S.presserUp) * (1 - Math.exp(-h / 0.12));
  };

  // ---------------------------------------------------------- the frame
  let acc = 0;
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frameTimes = [];
  const frame = (now) => {
    const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
    last = now;
    acc += dt;
    while (acc >= STEP) {
      step(STEP);
      acc -= STEP;
    }
    if (quality < QUALITY.length - 1) {
      perf.age += dt;
      if (perf.age > 0.6) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.022 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= 2) {
            quality++;
            applyQuality();
            perf.age = 0;
            perf.slow = 0;
          }
        }
      }
    }
    frameTimes.push(dt);
    if (frameTimes.length > 1200) frameTimes.shift();

    const state = presentNow();
    const sol = solve({theta: S.theta, rpm: S.rpm, stitchMM: S.stitchMM, presserUp: S.presserUp, tension: S.tension});
    machine.update(sol, {id: state.id ?? null, p: state.p ?? 0});
    const cam = cameraFor(state, orbit, tour.on ? tourT() : 0, tour.on, machine.sizes);
    stage.frame(cam);

    // callouts: the presented part's labels, projected into the layout
    const open = state.id ? BY_ID[state.id] : null;
    let callouts = null;
    if (open && state.p > 0.3) {
      const g = machine.groups[open.id];
      g.updateMatrixWorld(true);
      callouts = open.callouts.map((c) => {
        const v = new THREE.Vector3(...c.at).applyMatrix4(g.matrixWorld);
        const p = stage.project(v);
        return {label: c.label, sub: c.sub, at: [p.x, p.y]};
      });
    }
    const cap = tour.on ? captionAt(tourT(), TOUR_CAPTIONS) : null;
    ui.update({
      sol,
      running: S.target > 0 || S.rpm > 5,
      pumping: S.pumping,
      presserUp: S.presserUp,
      stitchMM: S.stitchMM,
      spm: S.rpm,
      openId: open?.id ?? null,
      openP: state.p ?? 0,
      hoverId,
      callouts,
      caption: cap,
      tour: tour.on,
      hintText: tour.on ? 'Auto tour · any key, click or drag takes over' : 'Drag the machine to orbit · scroll to zoom · drag the balance wheel to scrub · 1–0, Q W E T Y U open a part · R resets',
      curves,
      onGo: (id) => openPart(id),
    });
    // the 3D hover: a thin box round the part under the pointer, built when the pointer arrives on a part
    const hg = hoverId ? machine.groups[hoverId] : null;
    if (hg !== hoverGroup) {
      hoverGroup = hg;
      if (hover) {
        stage.scene.remove(hover);
        hover.dispose?.();
        hover = null;
      }
      if (hg) {
        hover = new THREE.BoxHelper(hg, 0xd6182b);
        stage.scene.add(hover);
      }
    }
    if (hover) hover.update?.();

    if (!shownOnce) {
      shownOnce = true;
      if (!window.SIM_SHOWN) {
        window.SIM_SHOWN = true;
        dispatchEvent(new Event('simframe'));
      }
    }
    requestAnimationFrame(frame);
  };

  // every shader compiles off the main thread before the first frame (kit/warm.js)
  await stage.warm();
  window.SINGER = {
    S,
    live,
    tour,
    orbit,
    machine,
    stage,
    openPart,
    resetAll,
    solve,
    presentNow,
    transforms: () => machine.transforms(),
    home: () => machine.homeTransforms(),
    ids: IDS,
    stats: () => {
      const f = frameTimes.slice(-600);
      const avg = f.reduce((a, b) => a + b, 0) / Math.max(1, f.length);
      return {frames: f.length, avgMS: avg * 1000, quality};
    },
    log: () => live.events,
    time: () => S.t,
  };
  // the page starts at rest; the tour begins only after `idle` seconds of quiet (see step())
  requestAnimationFrame((t) => {
    last = t;
    requestAnimationFrame(frame);
  });
  return window.SINGER;
}
