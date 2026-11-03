// Presenter: which subsystem is on display, and how far along its open motion (0 = home, 1 = presented), at any time.
// Pure: the state at time t is built from a list of events {t, type: 'open', id} | {t, type: 'close'} | {t, type: 'reset'}.
// Opening B while A is open closes A first, then opens B; a new event never cuts a motion short, it queues after it.
// The live page, the idle tour and the film all use this one function, so they cannot disagree.

export const OPEN_S = 1.1; // seconds for a full open (entrances: an ease-out)
export const CLOSE_S = 0.8; // seconds for a full close (exits: an ease-in, a little quicker)

const easeOut = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const easeIn = (x) => Math.pow(Math.min(1, Math.max(0, x)), 2.2);
const seg = (s, t) => {
  const k = (t - s.t0) / (s.t1 - s.t0);
  const e = s.p1 > s.p0 ? easeOut(k) : easeIn(k);
  return s.p0 + (s.p1 - s.p0) * e;
};

/** Build the motion segments from events. initial = {id, p} at the start of the log (the state before any event). */
export function build(events = [], initial = {id: null, p: 0}) {
  const segs = [];
  let cur = {id: initial.id ?? null, p: initial.p ?? 0};
  let end = -Infinity;
  const sorted = events.slice().sort((a, b) => a.t - b.t);
  for (const e of sorted) {
    const target = e.type === 'open' ? e.id : null;
    if (e.type !== 'open' && e.type !== 'close' && e.type !== 'reset') continue;
    let start = Math.max(e.t, end);
    // already there: opening what is open, or closing what is shut
    if (target !== null && cur.id === target && cur.p >= 1) continue;
    if (target === null && cur.id === null) continue;
    // close whatever is open (or opening) before anything else
    if (cur.id !== null && cur.id !== target && cur.p > 0) {
      const dur = CLOSE_S * cur.p;
      segs.push({t0: start, t1: start + dur, id: cur.id, p0: cur.p, p1: 0});
      start += dur;
      cur = {id: null, p: 0};
    }
    if (target !== null) {
      const p0 = cur.id === target ? cur.p : 0;
      const dur = OPEN_S * (1 - p0);
      segs.push({t0: start, t1: start + dur, id: target, p0, p1: 1});
      start += dur;
      cur = {id: target, p: 1};
    } else {
      cur = {id: null, p: 0};
    }
    end = start;
  }
  return {segs, initial: {id: initial.id ?? null, p: initial.p ?? 0}};
}

/** The presented subsystem and its progress at time t. */
export function stateAt(t, events = [], initial) {
  const {segs, initial: init} = build(events, initial);
  let st = {id: init.id, p: init.p};
  for (const s of segs) {
    if (t < s.t0) return st;
    if (t <= s.t1) return {id: s.id, p: seg(s, t), moving: true};
    st = {id: s.p1 > 0 ? s.id : null, p: s.p1};
  }
  return st;
}

/** True when nothing moves at time t (used by the tests and the captions). */
export const settledAt = (t, events, initial) => {
  const {segs} = build(events, initial);
  return segs.every((s) => t < s.t0 || t > s.t1);
};
