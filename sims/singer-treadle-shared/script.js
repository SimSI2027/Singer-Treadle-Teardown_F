// The one script behind the idle tour and the film: presenter events (which part is on display), the balance wheel's
// speed target, the captions, and the overview's orbit. Pure data and pure functions of time. The film renders this
// timeline frame by frame; the live page plays it as the idle tour and hands control over on the first input.
import {stateAt, build} from './presenter.js';

export const DURATION = 88; // seconds; the film is this long, and the tour loops it

// Presenter events: a part is opened, the presenter closes the last one first (see presenter.js).
export const EVENTS = [
  {t: 12.0, type: 'open', id: 'treadle'},
  {t: 20.5, type: 'open', id: 'pitman_rod'},
  {t: 28.0, type: 'open', id: 'belt_drive'},
  {t: 35.5, type: 'open', id: 'drive_wheel'},
  {t: 43.0, type: 'open', id: 'crankshaft'},
  {t: 50.5, type: 'open', id: 'needle_assembly'},
  {t: 58.0, type: 'open', id: 'shuttle'},
  {t: 65.5, type: 'open', id: 'gear_train'},
  {t: 73.0, type: 'open', id: 'thread_guide_path'},
  {t: 80.5, type: 'close'},
];

// Balance-wheel speed targets, stitches a minute. The machine's speed follows the target with a lag (see advance()).
export const RPM = [
  {t: 0, rpm: 0},
  {t: 6, rpm: 240},
  {t: 60, rpm: 300},
  {t: 76, rpm: 420},
  {t: 82, rpm: 300},
];

// Captions: one card at a time, short phrases (SKILL.md: 1 s plus 0.25 s per word beyond three).
export const CAPTIONS = [
  {t0: 0.5, t1: 6.2, head: 'A SINGER TREADLE, c. 1880–1915', sub: 'Sixteen parts. One stitch per turn of the balance wheel.'},
  {t0: 6.4, t1: 11.8, head: 'Pump the treadle', sub: 'The foot is where the power enters.'},
  {t0: 12.2, t1: 19.9, head: 'The treadle rocks about 24°', sub: 'A four-bar linkage turns the rocking into rotation.'},
  {t0: 20.7, t1: 27.6, head: 'The pitman rod', sub: 'It carries the treadle’s stroke to a crank pin on the band wheel.'},
  {t0: 28.2, t1: 35.2, head: 'The leather belt', sub: 'The band wheel is 2.31 times the balance wheel: it drives it faster.'},
  {t0: 35.7, t1: 42.7, head: 'The balance wheel', sub: 'One turn of it is one stitch.'},
  {t0: 43.2, t1: 50.2, head: 'The arm shaft', sub: 'Its crank and a link drive the needle bar.'},
  {t0: 50.7, t1: 57.7, head: 'The needle', sub: 'A 30 mm stroke. The take-up lever leads it by 30°.'},
  {t0: 58.2, t1: 65.2, head: 'The vibrating shuttle', sub: 'Its point sweeps through the loop at the needle’s lowest point.'},
  {t0: 65.7, t1: 72.7, head: 'The feed dog', sub: 'It moves the cloth only while the needle is out of it.'},
  {t0: 73.2, t1: 80.2, head: 'The thread path', sub: 'Spool, tension, take-up lever, needle.'},
  {t0: 80.7, t1: 87.5, head: 'Press a number to open a part', sub: 'Drag to orbit · scroll to zoom · keys 1–0, Q W E T Y U'},
];

const smooth = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};

/** Speed target at time t (stitches a minute): the last step at or before t. */
export function rpmTargetAt(t) {
  let v = RPM[0].rpm;
  for (const r of RPM) if (t >= r.t) v = r.rpm;
  return v;
}

/** One fixed step of the machine: the speed approaches its target with a time constant, the wheel turns at the speed. */
export const TAU = 0.45; // seconds
export function advance(s, dt, target) {
  const k = 1 - Math.exp(-dt / TAU);
  const rpm = s.rpm + (target - s.rpm) * k;
  const theta = s.theta + rpm * 6 * dt; // rpm × 360° / 60 s
  return {theta, rpm};
}

/** The machine's state over the whole script, sampled at a fixed step: a pure table (the film reads it, not the clock). */
export function machineTable(dt = 1 / 240, dur = DURATION + 1) {
  const out = [];
  let s = {theta: 0, rpm: 0};
  for (let t = 0; t <= dur + 1e-9; t += dt) {
    out.push({t, theta: s.theta, rpm: s.rpm});
    s = advance(s, dt, rpmTargetAt(t));
  }
  return out;
}

/** The presenter state at time t for the script. */
export const presentAt = (t, events = EVENTS, initial) => stateAt(t, events, initial);

/** The caption showing at time t, with its opacity (0..1) for a short fade. */
export function captionAt(t) {
  for (const c of CAPTIONS) {
    if (t >= c.t0 && t <= c.t1) {
      const fade = Math.min(1, (t - c.t0) / 0.35, (c.t1 - t) / 0.35);
      return {...c, opacity: smooth(fade)};
    }
  }
  return null;
}

/** The overview's orbit: a quarter turn in the first twelve seconds, then it holds. */
export const overviewAz = (t) => 26 + 34 * (1 - smooth(t / 12));

/** The beat times the film's timeline file and the review sheets use. */
export function timelineBeats() {
  return {
    duration: DURATION,
    fps: 60,
    captions: CAPTIONS.map((c) => c.t0),
    opens: EVENTS.filter((e) => e.type === 'open').map((e) => e.t),
    speed: RPM.map((r) => r.t),
    phases: build(EVENTS).segs.map((s) => s.t0),
  };
}
