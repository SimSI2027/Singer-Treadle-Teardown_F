// The scripts behind the idle tour and the film. Each is a list of beats: a part comes forward (or the overview holds),
// with a caption. The tour visits all sixteen parts; the film is the drive chain and the stitch, about 80 s. Both are
// pure data and pure functions of time: the live page plays the tour, the film renders its script frame by frame.
import {stateAt, build} from './presenter.js';

const smooth = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};

// Caption timing: 1 s for a short phrase plus 0.25 s per word beyond three (SKILL.md, review checklist).
const captionSeconds = (head, sub = '') => Math.max(3.2, 1 + 0.25 * Math.max(0, (head + ' ' + sub).split(' ').length - 3));

/** Lay the beats end to end from time 0. A beat is {id|null, head, sub, dur?}; id null means the overview holds. */
function lay(beats) {
  let t = 0;
  const events = [];
  const captions = [];
  for (const b of beats) {
    const dur = b.dur ?? captionSeconds(b.head, b.sub);
    if (b.id) events.push({t, type: 'open', id: b.id});
    else if (events.length) events.push({t, type: 'close'});
    captions.push({t0: t + 0.25, t1: t + dur - 0.25, head: b.head, sub: b.sub ?? ''});
    t += dur;
  }
  events.push({t, type: 'close'});
  return {events, captions, duration: t};
}

// the drive chain, in order: treadle → pitman → band wheel → belt → balance wheel → arm shaft → needle → shuttle → feed → thread
const CHAIN = [
  {id: 'treadle', head: 'The treadle rocks about 24°', sub: 'A four-bar linkage turns the rocking into rotation.', dur: 6.6},
  {id: 'pitman_rod', head: 'The pitman rod', sub: 'It carries the stroke to a crank pin on the band wheel.', dur: 6},
  {id: 'belt_drive', head: 'The leather belt', sub: 'The band wheel is 2.31 times the balance wheel, so it drives it faster.', dur: 6.5},
  {id: 'drive_wheel', head: 'The balance wheel', sub: 'One turn of it is one stitch.', dur: 6},
  {id: 'crankshaft', head: 'The arm shaft', sub: 'Its crank and a link drive the needle bar.', dur: 6},
  {id: 'needle_assembly', head: 'The needle', sub: 'A 30 mm stroke. The take-up lever leads it by 30°.', dur: 6.5},
  {id: 'shuttle', head: 'The vibrating shuttle', sub: 'Its point sweeps through the loop at the needle’s lowest point.', dur: 6.5},
  {id: 'gear_train', head: 'The feed dog', sub: 'It moves the cloth only while the needle is out of it.', dur: 6.5},
  {id: 'thread_guide_path', head: 'The thread path', sub: 'Spool, tension, take-up lever, needle.', dur: 6.5},
];
// the rest of the machine, for the tour
const REST = [
  {id: 'presser_foot', head: 'The presser foot', sub: 'Holds the cloth flat on the feed dog.', dur: 5},
  {id: 'bobbin', head: 'The bobbin and winder', sub: 'Fills the bobbin that sits in the shuttle.', dur: 5},
  {id: 'tension_regulator', head: 'The tension discs', sub: 'Clamp the upper thread; the thumb nut sets the pressure.', dur: 5},
  {id: 'spool_pin', head: 'The spool pin', sub: 'Holds the spool, with a light felt drag.', dur: 5},
  {id: 'machine_head', head: 'The machine head', sub: 'Its face plate swings open to oil the works.', dur: 5.5},
  {id: 'cabinet', head: 'The cabinet and stand', sub: 'Oak top, cast-iron standards, a folding drop leaf.', dur: 5.5},
  {id: 'drawers', head: 'The drawers', sub: 'Brass pulls; the centre drop front makes a work surface.', dur: 5.5},
];
const INTRO = {id: null, head: 'A SINGER TREADLE, c. 1880–1915', sub: 'Sixteen parts. One stitch per turn of the balance wheel.', dur: 8};
const OUTRO = {id: null, head: 'Press a number to open a part', sub: 'Drag to orbit · scroll to zoom · keys 1–0, Q W E T Y U', dur: 10};

const FILM = lay([INTRO, ...CHAIN, OUTRO]);
const TOUR = lay([INTRO, ...CHAIN, ...REST, OUTRO]);

export const FILM_EVENTS = FILM.events;
export const FILM_CAPTIONS = FILM.captions;
export const FILM_DURATION = FILM.duration;
export const TOUR_EVENTS = TOUR.events;
export const TOUR_CAPTIONS = TOUR.captions;
export const TOUR_DURATION = TOUR.duration;

// the speed schedule (stitches a minute), by script time: 0 at rest, up to a steady run, a slight rise, down at the end
const speedFor = (duration) => [
  {t: 0, rpm: 0},
  {t: 6, rpm: 240},
  {t: 30, rpm: 300},
  {t: duration - 14, rpm: 360},
  {t: duration - 6, rpm: 240},
];
export const FILM_RPM = speedFor(FILM_DURATION);
export const TOUR_RPM = speedFor(TOUR_DURATION);

/** Speed target at script time t (stitches a minute): the last step at or before t. */
export function rpmTargetAt(t, rpm = TOUR_RPM) {
  let v = rpm[0].rpm;
  for (const r of rpm) if (t >= r.t) v = r.rpm;
  return v;
}

/** One fixed step of the machine: the speed approaches its target with a time constant; the wheel turns at the speed. */
export const TAU = 0.45; // seconds
export function advance(s, dt, target) {
  const k = 1 - Math.exp(-dt / TAU);
  const rpm = s.rpm + (target - s.rpm) * k;
  const theta = s.theta + rpm * 6 * dt; // rpm × 360° / 60 s
  return {theta, rpm};
}

/** The machine's state over a script, sampled at a fixed step: a pure table the film reads (never the clock). */
export function machineTable(rpm, duration, dt = 1 / 240) {
  const out = [];
  let s = {theta: 0, rpm: 0};
  for (let t = 0; t <= duration + 1 + 1e-9; t += dt) {
    out.push({t, theta: s.theta, rpm: s.rpm});
    s = advance(s, dt, rpmTargetAt(t, rpm));
  }
  return out;
}

/** The caption showing at time t, with its opacity (0..1) for a short fade. */
export function captionAt(t, captions) {
  for (const c of captions) {
    if (t >= c.t0 && t <= c.t1) {
      const fade = Math.min(1, (t - c.t0) / 0.35, (c.t1 - t) / 0.35);
      return {...c, opacity: smooth(fade)};
    }
  }
  return null;
}

/** The overview's orbit: a quarter turn in the first twelve seconds, then it holds. */
export const overviewAz = (t) => 26 + 34 * (1 - smooth(t / 12));

/** The presenter state at time t for a script. */
export const presentAt = (t, events, initial) => stateAt(t, events, initial);

/** Beat times for the film's timeline file: every number is a beat, so capture.mjs --stills beats samples each one. */
export function timelineBeats() {
  return {
    duration: FILM_DURATION,
    fps: 60,
    captions: FILM_CAPTIONS.map((c) => c.t0),
    opens: FILM_EVENTS.filter((e) => e.type === 'open').map((e) => e.t),
  };
}

export const phasesOf = (events) => build(events).segs.map((s) => ({id: s.id, t0: s.t0, t1: s.t1}));
