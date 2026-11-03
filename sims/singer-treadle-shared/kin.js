// Kinematics of the Singer treadle machine. Pure: no three.js, no DOM, no clock. Every pose and every panel number is a
// function of one master angle θ (the hand wheel's shaft angle, degrees, unwrapped) plus the controls in `state`.
//
// Units: metres, Y up. The operator sits on +z and faces -z. Angles in degrees at the API, radians inside.
//
// Chain (the exhibit's spine):  treadle → pitman rod → crank pin on the big band wheel → leather belt → balance wheel
// (θ) → arm shaft → crank → needle bar; the take-up lever, the vibrating shuttle and the feed dog are driven from the
// same shaft. One stitch = one turn of the balance wheel, so stitches per minute equal the balance wheel's rpm.

export const DIM = {
  table: {y: 0.76, hx: 0.45, hz: 0.23, t: 0.035},
  cabinet: {y0: 0.22, y1: 0.725, hx: 0.385, z0: -0.2, z1: 0.2},
  stand: {x: 0.41, t: 0.024, y0: 0.0, y1: 0.725}, // cast-iron standards either side of the cabinet
  leaf: {x: -0.478, t: 0.012, y0: 0.225, y1: 0.735, hz: 0.23}, // the drop leaf, folded down the left side
  // the big band wheel under the table (called "the drive wheel" in the chain; it belongs to belt_drive)
  band: {x: 0.5, cy: 0.34, cz: -0.14, R: 0.15, rc: 0.05, t: 0.022},
  // the balance / hand wheel on the arm shaft (subsystem drive_wheel)
  hand: {x: 0.5, cy: 1.0, cz: -0.02, R: 0.065, t: 0.02},
  shaft: {cy: 1.0, cz: -0.02, x0: -0.14, x1: 0.5, r: 0.009},
  arm: {x0: -0.14, x1: 0.33, cy: 1.0, hy: 0.06, hz: 0.05},
  pillar: {x: 0.33, z: -0.02, y0: 0.81, y1: 1.06, hx: 0.05, hz: 0.05},
  bed: {x0: -0.14, x1: 0.33, z0: -0.09, z1: 0.05, y0: 0.76, y1: 0.81},
  plate: {y: 0.81, x: -0.07, z: -0.02, hx: 0.045, hz: 0.035},
  // needle bar, crank pin radius R, connecting link L; the bar's axis is the arm shaft's plane (z = shaft z)
  needle: {x: -0.09, z: -0.02, R: 0.015, L: 0.085, tipTop: 0.83, eyeAbove: 0.012},
  presser: {barX: -0.135, z: -0.02, soleY: 0.816, footX: -0.09, lift: 0.012, topY: 1.02},
  takeup: {x: 0.0, y: 0.97, z: 0.07, len: 0.07, amp: 35, lead: 30},
  spool: {x: -0.12, z: -0.1, y: 1.1, pinTop: 1.15, top: 1.06},
  winder: {x: 0.2, z: -0.06, y: 1.09},
  shuttle: {x: -0.06, z: -0.02, y: 0.8, rho: 0.03, amp: 30}, // the race's centre sits rho to the right of the needle
  feed: {x: -0.09, z: -0.02, yBase: 0.796, H: 0.016, S: 2.5, Smax: 4},
  // treadle lever: pivot (y, z) on the stand's outer side arm at x = treadle.x; B is the rear end (pitman joint),
  // F the foot pad at the front. The pitman joins B to the crank pin (x = pin.x) on the band wheel.
  treadle: {x: 0.44, py: 0.05, pz: -0.02, lb: 0.26, lf: 0.22, b: 0.32, pinX: 0.475, jointX: 0.455},
};

export const RATIO = DIM.hand.R / DIM.band.R; // band-wheel angle per hand-wheel angle (0.4333): 0.30 m / 0.13 m = 2.31:1
export const RATIO_LABEL = (DIM.band.R / DIM.hand.R).toFixed(2); // "2.31" : belt ratio (band wheel : hand wheel)
export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;
const TAU = Math.PI * 2;
export const wrap360 = (a) => ((((a % 360) + 360) % 360) + 360) % 360;
export const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};

// ------------------------------------------------------------------ the treadle: a four-bar linkage in the (y, z) plane
// Ground link: treadle pivot P to the band-wheel hub H. Crank: pin C on the hub, radius rc. Coupler: the pitman's
// planar length (B to C). Rocker: the treadle lever, pivot P to joint B. Each joint axis is parallel to x, so the 3-D
// pitman length reduces to the planar coupler length b = sqrt(L² - Δx²) and the solve is two circle intersections.
const PIV = [DIM.treadle.py, DIM.treadle.pz];
const HUB = [DIM.band.cy, DIM.band.cz];
const COUPLER = DIM.treadle.b; // planar coupler length: the pitman's length less its offset along x

/** The pitman joint B on the treadle for crank angle phi (radians, pin measured from +y toward +z). */
export function fourBar(phi, sign = 1) {
  const cy = HUB[0] + DIM.band.rc * Math.cos(phi);
  const cz = HUB[1] + DIM.band.rc * Math.sin(phi);
  const dy = cy - PIV[0];
  const dz = cz - PIV[1];
  const d = Math.hypot(dy, dz);
  const lb = DIM.treadle.lb;
  const a = (lb * lb - COUPLER * COUPLER + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, lb * lb - a * a));
  const by = PIV[0] + (a * dy) / d;
  const bz = PIV[1] + (a * dz) / d;
  // perpendicular to the ground-to-pin line; the branch is chosen once, so the solve is a pure function
  const py = (-dz / d) * sign * h;
  const pz = (dy / d) * sign * h;
  const B = [by + py, bz + pz];
  const reach = Math.abs(a) <= lb && d <= lb + COUPLER && d >= Math.abs(lb - COUPLER);
  return {B, C: [cy, cz], reach};
}
// one branch for the whole cycle (the one found by the geometry search in docs/research/linkage-search.md); it never
// toggles inside the crank's range, so the solve stays continuous without carrying state from frame to frame
const BRANCH = -1;
/** treadle tilt in degrees: positive = foot pad pressed down below horizontal */
export function treadleAt(phi) {
  const {B, reach} = fourBar(phi, BRANCH);
  const ry = B[0] - PIV[0];
  const rz = B[1] - PIV[1];
  const ang = Math.atan2(ry, -rz); // the rear end's angle from straight back: 0 when the lever is horizontal
  // the foot end is opposite the rear end, so the pad goes down when the rear end rises
  const tilt = ang * R2D;
  const F = [PIV[0] - (ry * DIM.treadle.lf) / DIM.treadle.lb, PIV[1] - (rz * DIM.treadle.lf) / DIM.treadle.lb];
  return {tilt, B, F, reach};
}
// The rest pose is the mean tilt over one turn of the crank, so the treadle swings about horizontal: ±12°.
export const TREADLE_REST = (() => {
  let s = 0;
  for (let i = 0; i < 360; i++) s += treadleAt(i * D2R).tilt;
  return s / 360;
})();

// ------------------------------------------------------------------ needle bar: a slider-crank on the arm shaft
const NEEDLE_K = (() => {
  const {R, L, tipTop} = DIM.needle;
  const yj0 = DIM.shaft.cy + R - Math.sqrt(L * L); // joint height with the pin at the top (θ = 0)
  return yj0 - tipTop; // constant offset from the joint to the needle tip
})();
/** needle joint and tip heights for hand-wheel angle theta (degrees) */
export function needleAt(theta) {
  const {R, L} = DIM.needle;
  const a = theta * D2R;
  const pinY = DIM.shaft.cy + R * Math.cos(a);
  const pinZ = DIM.shaft.cz + R * Math.sin(a);
  const jointY = pinY - Math.sqrt(Math.max(0, L * L - (pinZ - DIM.needle.z) ** 2));
  return {pin: [pinY, pinZ], jointY, tipY: jointY - NEEDLE_K};
}

// ------------------------------------------------------------------ the feed dog: a four-motion loop
// The dog's teeth rise through the throat plate only in a short window around θ = 0, where the needle is out of the
// cloth. Inside that window the dog carries the cloth forward by the stitch length; outside it the dog drops and
// returns. thetaE is where the rising dog reaches the plate's top surface.
const THETA_E = Math.acos(clamp((DIM.plate.y - DIM.feed.yBase) / DIM.feed.H, -1, 1)) * R2D;
export function feedAt(theta, S) {
  const f = wrap180(theta);
  const y = DIM.feed.yBase + DIM.feed.H * Math.max(0, Math.cos(f * D2R));
  let zs; // fraction of S/2 along the feed direction (-1 back .. +1 forward)
  if (Math.abs(f) < THETA_E) zs = Math.sin(f * D2R) / Math.sin(THETA_E * D2R);
  else {
    // the return: f runs from +θE to 360-θE (back to -θE) as the dog drops and comes back
    const g = f >= THETA_E ? f : f + 360;
    zs = 1 - 2 * smooth((g - THETA_E) / (360 - 2 * THETA_E));
  }
  return {y, z: DIM.feed.z + (S / 2) * clamp(zs, -1, 1), engaged: y > DIM.plate.y, phase: f};
}

// ------------------------------------------------------------------ take-up lever, shuttle
export function takeupAt(theta) {
  const {amp, lead, len, x, y, z} = DIM.takeup;
  const alpha = amp * Math.cos((theta + lead) * D2R); // eye up (+) and forward; leads the needle by `lead` degrees
  const a = alpha * D2R;
  return {alpha, eye: [x, y + len * Math.cos(a), z + len * Math.sin(a)]};
}
export function shuttleAt(theta) {
  const {amp, rho} = DIM.shuttle;
  const beta = amp * Math.sin((theta - 180) * D2R); // zero when the needle is at bottom dead centre
  const gamma = Math.PI + beta * D2R; // angle about the race centre; π is the point at the needle
  const cx = DIM.needle.x + rho;
  const cz = DIM.shuttle.z;
  const point = [cx + rho * Math.cos(gamma), DIM.shuttle.y, cz + rho * Math.sin(gamma)];
  return {beta, point, axis: wrap360((gamma + Math.PI / 2) * R2D), phase: wrap360(theta - 180)};
}

// ------------------------------------------------------------------ the whole machine
/**
 * state: {theta (deg), rpm (balance-wheel rpm, = stitches/min), stitchMM, presserUp (0..1), tension (0..1)}
 * returns every pose and every panel number. Pure and deterministic.
 */
export function solve(state = {}) {
  const theta = state.theta ?? 0;
  const rpm = Math.max(0, state.rpm ?? 0);
  const S = clamp(state.stitchMM ?? DIM.feed.S, 0, DIM.feed.Smax);
  const lift = clamp(state.presserUp ?? 0, 0, 1);
  const tension = clamp(state.tension ?? 0.5, 0, 1);

  const driveDeg = theta * RATIO; // band-wheel angle
  const tr = treadleAt(driveDeg * D2R);
  const needle = needleAt(theta);
  const tu = takeupAt(theta);
  const sh = shuttleAt(theta);
  const fd = feedAt(theta, S);
  const rimCircum = TAU * DIM.hand.R;
  const beltSpeed = (rpm / 60) * rimCircum; // m/s: the belt moves at the rim speed of both wheels
  const bandRpm = rpm * RATIO;
  const treadleDeg = tr.tilt - TREADLE_REST;
  const needleMM = (needle.tipY - DIM.plate.y) * 1000;

  const thread = [
    [DIM.spool.x, DIM.spool.pinTop, DIM.spool.z],
    [DIM.spool.x + 0.035, 1.075, DIM.spool.z + 0.07],
    [-0.035, 1.02, 0.075],
    tu.eye,
    [-0.035, 0.95, 0.06],
    [DIM.needle.x, needle.tipY + DIM.needle.eyeAbove, DIM.needle.z],
  ];

  return {
    theta,
    stitchCount: Math.floor(Math.max(0, theta) / 360),
    treadle: {tiltDeg: treadleDeg, B: tr.B, F: tr.F, reach: tr.reach},
    pitman: {
      B: [DIM.treadle.jointX, tr.B[0], tr.B[1]],
      C: [DIM.treadle.pinX, ...fourBar(driveDeg * D2R, BRANCH).C],
      length: Math.hypot(DIM.treadle.pinX - DIM.treadle.jointX, COUPLER),
    },
    band: {angleDeg: driveDeg},
    crankPin: needle.pin,
    needle: {tipY: needle.tipY, jointY: needle.jointY, mm: needleMM, out: needle.tipY > DIM.plate.y},
    takeup: {alphaDeg: tu.alpha, eye: tu.eye},
    shuttle: {betaDeg: sh.beta, point: sh.point, axisDeg: sh.axis, phaseDeg: sh.phase},
    feed: {y: fd.y, z: fd.z, engaged: fd.engaged, phaseDeg: fd.phase, stitchMM: S},
    presser: {soleY: DIM.presser.soleY + lift * DIM.presser.lift, lift},
    thread,
    tension,
    numbers: {
      handRpm: rpm,
      bandRpm,
      stitchesPerMin: rpm,
      beltSpeed,
      beltRatio: Number(RATIO_LABEL),
      treadleDeg,
      needleMM,
      takeupDeg: tu.alpha,
      shuttlePhaseDeg: sh.phase,
      feedPhaseDeg: fd.phase,
      stitchMM: S,
      stitchCount: Math.floor(Math.max(0, theta) / 360),
      tension10: tension * 10,
      cranksDeg: wrap360(theta),
    },
  };
}

/** The stitch-cycle curves over one turn (theta 0..360), for the timing strip and for tests. */
export function cycleCurves(samples = 360, S = DIM.feed.S) {
  const out = {theta: [], needleMM: [], takeupDeg: [], shuttleDeg: [], feedZ: [], feedY: []};
  for (let i = 0; i < samples; i++) {
    const th = (i * 360) / samples;
    const s = solve({theta: th, rpm: 0, stitchMM: S});
    out.theta.push(th);
    out.needleMM.push(s.needle.mm);
    out.takeupDeg.push(s.takeup.alphaDeg);
    out.shuttleDeg.push(s.shuttle.betaDeg);
    out.feedZ.push(s.feed.z - DIM.feed.z);
    out.feedY.push(s.feed.y);
  }
  return out;
}
