// The machine: procedural three.js geometry for the sixteen subsystems, posed from kin.js. Each subsystem is a named group
// (name === id). Static parts are merged per material into a few meshes; moving parts are posed by update(solution, open):
// the solver's angles drive the spinning wheels, the needle bar, the shuttle, the feed dog, the treadle, the pitman and
// the thread; the presenter's progress moves a subsystem to its display point, or articulates it in place.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {DIM, RATIO, D2R} from './kin.js';
import {SUBSYSTEMS, BY_ID} from './subsystems.js';
import {DISPLAY} from './subsystems.js';

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ small helpers
/** A transform: position (m), Euler rotation (degrees), scale. */
const mtx = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx * D2R, ry * D2R, rz * D2R)),
    new THREE.Vector3(sx, sy, sz),
  );

/** Merges the static pieces of one owner by material: one draw call per material. */
function batcher(owner) {
  const bins = new Map();
  return {
    add(geo, mat, m) {
      const g = (geo.index ? geo.toNonIndexed() : geo).clone();
      g.applyMatrix4(m);
      if (!bins.has(mat)) bins.set(mat, []);
      bins.get(mat).push(g);
      geo.dispose?.();
    },
    flush() {
      for (const [mat, list] of bins) {
        if (!list.length) continue;
        const merged = mergeGeometries(list, false);
        for (const g of list) g.dispose();
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        owner.add(mesh);
      }
      bins.clear();
    },
  };
}

/** A unit cylinder that setLink() stretches between two points (rods, links, belts' straight runs). */
function linkMesh(owner, r, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12), mat);
  m.castShadow = true;
  owner.add(m);
  return m;
}
const _d = new THREE.Vector3();
/** Stretches the unit cylinder m from point a to point b (both [x, y, z]). Differences are taken per axis: arrays have no .x. */
function setLink(m, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  if (!(len > 1e-9)) {
    m.scale.set(1, 1e-6, 1);
    return;
  }
  _d.set(dx / len, dy / len, dz / len);
  m.quaternion.setFromUnitVectors(UP, _d);
  m.scale.set(1, len, 1);
}
const V = (p) => [p[0], p[1], p[2]];

/** Convex hull (monotone chain) of 2-D points: the belt's outline round two wheels. */
function hull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const p of pts) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  const up = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  up.pop();
  lo.pop();
  return lo.concat(up);
}

// ------------------------------------------------------------------ geometry for the wheels and the belt
/** Spokes and rim of a wheel in its own plane (the y-z plane, axis along x), centred on the origin. */
function wheel(b, R, rimTube, mats, spokes = 6) {
  b.add(new THREE.TorusGeometry(R, rimTube, 10, 96), mats.rim, mtx(0, 0, 0, 0, 90, 0));
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * TAU;
    const L = R - 0.03;
    const rMid = 0.03 + L / 2;
    b.add(new THREE.BoxGeometry(0.014, L, 0.011), mats.spoke, mtx(0, rMid * Math.cos(a), rMid * Math.sin(a), (a * 180) / Math.PI, 0, 0));
  }
  b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 20), mats.hub, mtx(0, 0, 0, 0, 0, 90));
}

// ------------------------------------------------------------------ the machine
export function createMachine(M) {
  const root = new THREE.Group();
  root.name = 'singer-treadle';
  const G = {};
  for (const s of SUBSYSTEMS) {
    const g = new THREE.Group();
    g.name = s.id;
    g.userData.id = s.id;
    root.add(g);
    G[s.id] = g;
  }
  const dyn = {};

  // ---------------------------------------------------------- cabinet and stand (in place)
  {
    const g = G.cabinet;
    const b = batcher(g);
    b.add(new THREE.BoxGeometry(0.9, 0.035, 0.46), M.oak, mtx(0, 0.7425, 0));
    b.add(new THREE.BoxGeometry(0.77, 0.505, 0.4), M.oakDark, mtx(0, 0.4725, 0));
    b.add(new THREE.BoxGeometry(0.012, 0.5, 0.46), M.oak, mtx(DIM.leaf.x, 0.48, 0)); // the drop leaf, folded down
    b.add(new THREE.BoxGeometry(0.84, 0.02, 0.44), M.iron, mtx(0, 0.01, 0));
    for (const x of [-DIM.stand.x, DIM.stand.x]) {
      const t = DIM.stand.t;
      b.add(new THREE.BoxGeometry(t, 0.04, 0.44), M.iron, mtx(x, 0.705, 0));
      b.add(new THREE.BoxGeometry(t, 0.04, 0.44), M.iron, mtx(x, 0.04, 0));
      b.add(new THREE.BoxGeometry(t, 0.725, 0.04), M.iron, mtx(x, 0.3625, -0.2));
      b.add(new THREE.BoxGeometry(t, 0.725, 0.04), M.iron, mtx(x, 0.3625, 0.2));
      for (let i = 0; i < 5; i++) {
        const z = -0.16 + i * 0.08;
        b.add(new THREE.BoxGeometry(t * 0.8, 0.68, 0.012), M.iron, mtx(x, 0.37, z));
        const y = 0.1 + i * 0.12;
        b.add(new THREE.BoxGeometry(t * 0.8, 0.012, 0.4), M.iron, mtx(x, y, 0));
      }
    }
    b.flush();
  }

  // ---------------------------------------------------------- drawers (in place; articulated)
  {
    const g = G.drawers;
    const b = batcher(g);
    b.add(new THREE.BoxGeometry(0.24, 0.42, 0.3), M.oakDark, mtx(0, 0.46, -0.03));
    const bank = [
      {x: -0.26, y: 0.58, h: 0.22, pull: 0.02},
      {x: -0.26, y: 0.34, h: 0.17, pull: 0.02},
      {x: 0.26, y: 0.48, h: 0.44, pull: 0.04},
    ];
    dyn.drawers = [];
    for (const d of bank) {
      const dg = new THREE.Group();
      g.add(dg);
      dyn.drawers.push(dg);
      const db = batcher(dg);
      db.add(new THREE.BoxGeometry(0.2, d.h - 0.01, 0.34), M.oakDark, mtx(d.x, d.y, -0.02));
      db.add(new THREE.BoxGeometry(0.21, d.h, 0.012), M.oak, mtx(d.x, d.y, 0.19));
      db.add(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 10), M.brass, mtx(d.x, d.y + d.pull, 0.206, 90, 0, 0));
      db.flush();
    }
    // the centre drop front: hinged along its bottom edge, drops to a horizontal work surface
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.25, 0.2);
    g.add(hinge);
    dyn.dropFront = hinge;
    const hb = batcher(hinge);
    hb.add(new THREE.BoxGeometry(0.24, 0.42, 0.012), M.oak, mtx(0, 0.21, 0));
    hb.add(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 10), M.brass, mtx(0, 0.36, 0.008, 0, 0, 90));
    hb.flush();
    b.flush();
  }

  // ---------------------------------------------------------- the treadle: a rigid lever on an x-parallel pivot
  {
    const g = G.treadle;
    const b = batcher(g);
    const P = [DIM.treadle.x, DIM.treadle.py, DIM.treadle.pz];
    b.add(new THREE.CylinderGeometry(0.007, 0.007, 0.92, 14), M.nickel, mtx(0, P[1], P[2], 0, 0, 90));
    const rig = new THREE.Group();
    rig.position.set(0, P[1], P[2]);
    g.add(rig);
    dyn.treadle = rig;
    const rb = batcher(rig);
    const mid = (DIM.treadle.lf - DIM.treadle.lb) / 2;
    for (const x of [-DIM.treadle.x, DIM.treadle.x]) {
      rb.add(new THREE.BoxGeometry(0.012, 0.014, DIM.treadle.lb + DIM.treadle.lf), M.iron, mtx(x, 0, mid));
    }
    // the lattice plate at the foot end, cast iron with an openwork grid
    rb.add(new THREE.BoxGeometry(0.3, 0.008, 0.36), M.iron, mtx(0, 0.012, 0.08));
    for (let i = 0; i < 6; i++) rb.add(new THREE.BoxGeometry(0.3, 0.01, 0.012), M.iron, mtx(0, 0.02, -0.06 + i * 0.06));
    for (let i = 0; i < 4; i++) rb.add(new THREE.BoxGeometry(0.012, 0.01, 0.36), M.iron, mtx(-0.1 + i * 0.066, 0.02, 0.08));
    rb.add(new THREE.BoxGeometry(0.88, 0.012, 0.012), M.iron, mtx(0, 0.0, DIM.treadle.lf));
    rb.flush();
    b.flush();
  }

  // ---------------------------------------------------------- the big band wheel and the belt (belt_drive)
  {
    const g = G.belt_drive;
    const spin = new THREE.Group();
    spin.position.set(DIM.band.x, DIM.band.cy, DIM.band.cz);
    g.add(spin);
    dyn.band = spin;
    const wb = batcher(spin);
    wheel(wb, DIM.band.R - 0.008, 0.008, {rim: M.japan, spoke: M.japan, hub: M.japan});
    // the crank arm carries the pin that the pitman drives (on the inner face of the wheel)
    wb.add(new THREE.BoxGeometry(0.01, DIM.band.rc, 0.012), M.japan, mtx(-0.022, DIM.band.rc / 2, 0));
    wb.flush();
    // the belt: the convex outline round the band wheel and the balance wheel, in the plane x = DIM.band.x
    const A = [DIM.band.cy, DIM.band.cz, DIM.band.R];
    const Bw = [DIM.hand.cy, DIM.hand.cz, DIM.hand.R];
    const pts2 = [];
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * TAU;
      pts2.push([A[0] + A[2] * Math.cos(a), A[1] + A[2] * Math.sin(a)]);
      pts2.push([Bw[0] + Bw[2] * Math.cos(a), Bw[1] + Bw[2] * Math.sin(a)]);
    }
    const outline = hull(pts2);
    const curve = new THREE.CatmullRomCurve3(
      outline.map((p) => new THREE.Vector3(DIM.band.x, p[0], p[1])),
      true,
      'centripetal',
    );
    const belt = new THREE.Mesh(new THREE.TubeGeometry(curve, 320, 0.0055, 8, true), M.belt);
    belt.castShadow = true;
    g.add(belt);
    dyn.belt = belt;
    dyn.beltLength = curve.getLength();
    // the belt hook: a small bent staple on the back run
    const hk = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0015, 6, 14), M.nickel);
    hk.position.set(DIM.band.x, DIM.band.cy + 0.18, DIM.band.cz - 0.02);
    hk.rotation.set(0, Math.PI / 2, 0);
    g.add(hk);
  }

  // ---------------------------------------------------------- the pitman: a rod between the treadle and the crank pin
  {
    const g = G.pitman_rod;
    dyn.pitmanRod = linkMesh(g, 0.0045, M.nickel);
    dyn.pitmanB = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 12, 8), M.nickel);
    dyn.pitmanC = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 12, 8), M.nickel);
    g.add(dyn.pitmanB, dyn.pitmanC);
  }

  // ---------------------------------------------------------- the balance wheel (drive_wheel)
  {
    const g = G.drive_wheel;
    const spin = new THREE.Group();
    spin.position.set(DIM.hand.x, DIM.hand.cy, DIM.hand.cz);
    g.add(spin);
    dyn.hand = spin;
    const hb = batcher(spin);
    wheel(hb, DIM.hand.R - 0.007, 0.007, {rim: M.japan, spoke: M.japan, hub: M.japan});
    hb.add(new THREE.TorusGeometry(DIM.hand.R - 0.011, 0.0018, 6, 72), M.gold, mtx(0.009, 0, 0, 0, 90, 0));
    hb.add(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 14), M.brass, mtx(0.02, 0, 0, 0, 0, 90));
    hb.flush();
    const dec = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04), M.decal);
    g.add(dec);
    dec.visible = false;
  }

  // ---------------------------------------------------------- the arm shaft and its crank (crankshaft)
  {
    const g = G.crankshaft;
    const spin = new THREE.Group();
    spin.position.set(0, DIM.shaft.cy, DIM.shaft.cz);
    g.add(spin);
    dyn.shaft = spin;
    const sb = batcher(spin);
    sb.add(new THREE.CylinderGeometry(DIM.shaft.r, DIM.shaft.r, DIM.shaft.x1 - DIM.shaft.x0, 14), M.steel, mtx(0.18, 0, 0, 0, 0, 90));
    sb.add(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 24), M.japan, mtx(-0.05, 0, 0, 0, 0, 90));
    sb.add(new THREE.CylinderGeometry(0.004, 0.004, 0.02, 10), M.steel, mtx(-0.05, DIM.needle.R, 0, 0, 0, 90)); // crank pin
    sb.add(new THREE.BoxGeometry(0.02, 0.02, 0.03), M.japan, mtx(-0.05, -0.02, 0)); // counterweight
    sb.add(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 14), M.nickel, mtx(-0.1, 0, 0, 0, 0, 90)); // bushings
    sb.add(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 14), M.nickel, mtx(0.2, 0, 0, 0, 0, 90));
    sb.add(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 18), M.japan, mtx(0.0, 0.012, 0, 0, 0, 90)); // take-up eccentric
    sb.flush();
    dyn.link = linkMesh(g, 0.0035, M.japan);
  }

  // ---------------------------------------------------------- the needle bar, the take-up lever (needle_assembly)
  {
    const g = G.needle_assembly;
    const b = batcher(g);
    b.add(new THREE.CylinderGeometry(0.009, 0.009, 0.03, 16), M.nickel, mtx(DIM.needle.x, 0.945, DIM.needle.z));
    b.add(new THREE.CylinderGeometry(0.006, 0.006, 0.012, 16), M.japan, mtx(0.0, 0.97, DIM.takeup.z, 90, 0, 0)); // take-up stud
    b.flush();
    dyn.needleBar = linkMesh(g, 0.0035, M.japan);
    dyn.clamp = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.02, 0.014), M.japan);
    dyn.needle = linkMesh(g, 0.0009, M.steel);
    dyn.takeupLever = linkMesh(g, 0.0032, M.japan);
    dyn.takeupEye = new THREE.Mesh(new THREE.TorusGeometry(0.0055, 0.0014, 6, 16), M.steel);
    g.add(dyn.clamp, dyn.takeupEye);
  }

  // ---------------------------------------------------------- the presser bar and foot (presser_foot)
  {
    const g = G.presser_foot;
    const b = batcher(g);
    b.add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.19, 14), M.nickel, mtx(DIM.presser.barX, 0.935, DIM.presser.z));
    b.add(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 14), M.brass, mtx(DIM.presser.barX, 1.03, DIM.presser.z)); // thumb screw
    b.add(new THREE.BoxGeometry(0.02, 0.012, 0.014), M.japan, mtx(-0.12, 0.99, DIM.presser.z)); // lifter lever
    b.flush();
    dyn.foot = new THREE.Group();
    g.add(dyn.foot);
    const fb = batcher(dyn.foot);
    // the foot and its shank at their home height; dyn.foot.position.y raises them with the lifter
    fb.add(new THREE.BoxGeometry(0.03, 0.003, 0.028), M.nickel, mtx(DIM.presser.footX, DIM.presser.soleY, DIM.presser.z));
    fb.add(new THREE.BoxGeometry(0.1, 0.004, 0.005), M.nickel, mtx(-0.112, DIM.presser.soleY + 0.012, DIM.presser.z));
    fb.flush();
  }

  // ---------------------------------------------------------- the bobbin winder (bobbin)
  {
    const g = G.bobbin;
    const b = batcher(g);
    b.add(new THREE.CylinderGeometry(0.0035, 0.0035, 0.03, 10), M.steel, mtx(0.2, 1.085, -0.06));
    b.add(new THREE.CylinderGeometry(0.0075, 0.0075, 0.02, 18), M.white, mtx(0.2, 1.1, -0.06));
    b.add(new THREE.CylinderGeometry(0.011, 0.011, 0.002, 18), M.nickel, mtx(0.2, 1.093, -0.06));
    b.add(new THREE.CylinderGeometry(0.011, 0.011, 0.002, 18), M.nickel, mtx(0.2, 1.107, -0.06));
    b.add(new THREE.TorusGeometry(0.012, 0.003, 8, 24), M.rubber, mtx(0.23, 1.06, -0.06, 0, 90, 0));
    b.add(new THREE.BoxGeometry(0.04, 0.01, 0.03), M.japan, mtx(0.21, 1.065, -0.06));
    b.add(new THREE.BoxGeometry(0.01, 0.02, 0.012), M.japan, mtx(0.17, 1.07, -0.06));
    b.flush();
  }

  // ---------------------------------------------------------- the spool pin, felt pad and spool (spool_pin)
  {
    const g = G.spool_pin;
    const b = batcher(g);
    b.add(new THREE.CylinderGeometry(0.0025, 0.0025, 0.09, 10), M.nickel, mtx(DIM.spool.x, 1.105, DIM.spool.z));
    b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 24), M.felt, mtx(DIM.spool.x, 1.075, DIM.spool.z));
    b.flush();
    const spool = new THREE.Group();
    spool.position.set(DIM.spool.x, DIM.spool.y, DIM.spool.z);
    g.add(spool);
    dyn.spool = spool;
    const profile = [[0, -0.02], [0.028, -0.02], [0.028, -0.017], [0.014, -0.014], [0.014, 0.014], [0.028, 0.017], [0.028, 0.02], [0, 0.02]].map(
      ([r, y]) => new THREE.Vector2(r, y),
    );
    const sb = batcher(spool);
    sb.add(new THREE.LatheGeometry(profile, 28), M.wood, mtx());
    sb.add(new THREE.CylinderGeometry(0.0175, 0.0175, 0.032, 28), M.thread, mtx());
    sb.flush();
  }

  // ---------------------------------------------------------- tension discs, spring and thumb nut (tension_regulator)
  {
    const g = G.tension_regulator;
    const b = batcher(g);
    b.add(new THREE.BoxGeometry(0.02, 0.04, 0.02), M.japan, mtx(DIM.takeup.x - 0.035, 1.0, 0.06));
    b.add(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 20), M.japan, mtx(-0.035, 1.07, 0.075, 90, 0, 0)); // thumb nut
    const coil = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU * 3;
      coil.push(new THREE.Vector3(-0.035 + 0.008 * Math.cos(a), 1.03 + (i / 40) * 0.025, 0.075 + 0.008 * Math.sin(a)));
    }
    b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 120, 0.0012, 6, false), M.steel, mtx());
    b.flush();
    dyn.discA = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.003, 24), M.nickel);
    dyn.discB = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.003, 24), M.nickel);
    for (const d of [dyn.discA, dyn.discB]) {
      d.rotation.x = Math.PI / 2;
      d.position.set(-0.035, 1.02, 0.075);
      g.add(d);
    }
  }

  // ---------------------------------------------------------- the thread: guides, the path, the flow (thread_guide_path)
  {
    const g = G.thread_guide_path;
    const b = batcher(g);
    for (const p of [[DIM.spool.x + 0.035, 1.075, DIM.spool.z + 0.07], [-0.035, 1.02, 0.075], [-0.035, 0.95, 0.06]]) {
      b.add(new THREE.TorusGeometry(0.0045, 0.0009, 6, 14), M.steel, mtx(p[0], p[1], p[2], 0, 90, 0));
    }
    b.flush();
    dyn.thread = [];
    for (let i = 0; i < 5; i++) dyn.thread.push(linkMesh(g, 0.0028, M.thread));
    dyn.beads = [];
    for (let i = 0; i < 4; i++) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 8, 6), M.thread);
      g.add(bead);
      dyn.beads.push(bead);
    }
    dyn.eyeMarks = [];
  }

  // ---------------------------------------------------------- the feed dog, cams and rock shaft (gear_train)
  {
    const g = G.gear_train;
    const b = batcher(g);
    b.add(new THREE.CylinderGeometry(0.006, 0.006, 0.44, 12), M.steel, mtx(0, 0.72, -0.02, 0, 0, 90)); // bottom shaft
    b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 24), M.japan, mtx(-0.14, 0.72, -0.02, 0, 0, 90)); // feed cam
    b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 24), M.japan, mtx(0.12, 0.72, -0.02, 0, 0, 90)); // shuttle cam
    b.add(new THREE.CylinderGeometry(0.005, 0.005, 0.22, 12), M.nickel, mtx(-0.09, 0.755, 0.02, 0, 0, 90)); // rock shaft
    b.flush();
    dyn.dog = new THREE.Group();
    g.add(dyn.dog);
    const db = batcher(dyn.dog);
    // the dog sits at its home (x, z); the solver moves it forward and back by its stitch length
    db.add(new THREE.BoxGeometry(0.022, 0.004, 0.09), M.iron, mtx(DIM.feed.x, 0, DIM.feed.z));
    for (let i = 0; i < 5; i++) db.add(new THREE.BoxGeometry(0.011, 0.006, 0.011), M.iron, mtx(DIM.feed.x, 0.004, DIM.feed.z - 0.036 + i * 0.018));
    db.flush();
  }

  // ---------------------------------------------------------- the vibrating shuttle, race and slide plate (shuttle)
  {
    const g = G.shuttle;
    const b = batcher(g);
    const pts = [];
    const cx = DIM.needle.x + DIM.shuttle.rho;
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI - 0.62 + (i / 24) * 1.24;
      pts.push(new THREE.Vector3(cx + DIM.shuttle.rho * Math.cos(a), DIM.shuttle.y, DIM.shuttle.z + DIM.shuttle.rho * Math.sin(a)));
    }
    b.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.0022, 6, false), M.steel, mtx());
    b.add(new THREE.BoxGeometry(0.02, 0.012, 0.04), M.iron, mtx(cx, DIM.shuttle.y - 0.012, DIM.shuttle.z));
    b.flush();
    // the shuttle body: a lathed boat, its point toward +x in its own frame
    const prof = [[0, -0.5], [0.06, -0.42], [0.12, -0.3], [0.14, -0.1], [0.13, 0.2], [0.1, 0.38], [0.04, 0.48], [0, 0.5]].map(
      ([r, y]) => new THREE.Vector2(r, y),
    );
    const boatGeo = new THREE.LatheGeometry(prof, 24);
    boatGeo.rotateZ(Math.PI / 2);
    boatGeo.scale(0.03, 0.0055 / 0.14, 0.0055 / 0.14); // a slim boat: about 6 mm wide, 30 mm long
    dyn.shuttle = new THREE.Mesh(boatGeo, M.nickel);
    dyn.shuttle.castShadow = true;
    g.add(dyn.shuttle);
    dyn.slidePlate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.012), M.steel);
    dyn.slidePlate.position.set(-0.07, 0.79, DIM.bed.z1 + 0.006);
    g.add(dyn.slidePlate);
  }

  // ---------------------------------------------------------- the head: bed, pillar, arm, face plate, needle plate
  {
    const g = G.machine_head;
    const b = batcher(g);
    const bed = DIM.bed;
    b.add(new THREE.BoxGeometry(bed.x1 - bed.x0, bed.y1 - bed.y0, bed.z1 - bed.z0), M.japan, mtx((bed.x0 + bed.x1) / 2, (bed.y0 + bed.y1) / 2, (bed.z0 + bed.z1) / 2));
    b.add(new THREE.BoxGeometry(0.1, 0.25, 0.1), M.japan, mtx(DIM.pillar.x, 0.935, DIM.pillar.z));
    b.add(new THREE.BoxGeometry(0.5, 0.12, 0.1), M.japan, mtx(0.11, DIM.arm.cy, -0.02));
    b.add(new THREE.BoxGeometry(0.4, 0.004, 0.03), M.gold, mtx(0.1, 1.063, -0.02));
    b.add(new THREE.BoxGeometry(0.09, 0.004, 0.07), M.nickel, mtx(DIM.plate.x, DIM.plate.y + 0.002, DIM.plate.z));
    b.add(new THREE.BoxGeometry(0.2, 0.004, 0.016), M.gold, mtx(0.1, 0.8, bed.z1 + 0.001)); // gold line on the bed front
    b.flush();
    // the decal on the arm and on the bed
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.0375), M.decal);
    decal.position.set(0.1, 0.785, bed.z1 + 0.0035);
    g.add(decal);
    // the face plate hinges at its left edge and swings toward the operator
    const fp = new THREE.Group();
    fp.position.set(-0.12, DIM.arm.cy, 0.035);
    g.add(fp);
    dyn.facePlate = fp;
    const fb = batcher(fp);
    fb.add(new THREE.BoxGeometry(0.4, 0.09, 0.012), M.japan, mtx(0.2, 0, 0));
    fb.flush();
    const fdec = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.04), M.decal);
    fdec.position.set(0.2, 0, 0.0065);
    fp.add(fdec);
  }

  // ---------------------------------------------------------- ghosting: the rest of the machine dims while a part is on display
  const ghostOf = new Map();
  for (const k of Object.keys(M)) if (k !== 'ghost') ghostOf.set(M[k], M.ghost[k]);
  const meshesOf = {};
  for (const s of SUBSYSTEMS) {
    meshesOf[s.id] = [];
    G[s.id].traverse((o) => {
      if (o.isMesh) meshesOf[s.id].push(o);
    });
  }
  /** Ghost every part but the presented one; the ghost's opacity follows the presenter's progress. */
  function applyGhost(openId, p) {
    const e = Math.min(1, Math.max(0, p));
    for (const k of Object.keys(M.ghost)) M.ghost[k].opacity = 1 - 0.88 * e;
    for (const s of SUBSYSTEMS) {
      const dim = !!openId && s.id !== openId && e > 0;
      for (const m of meshesOf[s.id]) {
        if (!m.userData.base) m.userData.base = m.material;
        m.material = dim ? ghostOf.get(m.userData.base) ?? m.userData.base : m.userData.base;
      }
    }
  }

  // ---------------------------------------------------------- each part's size at home (metres): the camera frames it when it is presented
  const sizes = {};
  for (const s of SUBSYSTEMS) {
    const box = new THREE.Box3().setFromObject(G[s.id]);
    const v = new THREE.Vector3();
    box.getSize(v);
    sizes[s.id] = Math.max(v.x, v.y, v.z, 0.02);
  }
  // the shuttle's slide plate is 14 cm long and would make the framing drift back; the race and the boat are the subject
  sizes.shuttle = 0.05;
  // the treadle's cross-bar spans the stand (0.88 m); the foot plate and the lever are the subject
  sizes.treadle = 0.5;
  // the feed mechanism's bottom shaft is 0.44 m; the dog and its cams are the subject. The thread path is framed on the thread.
  sizes.gear_train = 0.09;
  sizes.thread_guide_path = 0.2;

  // ---------------------------------------------------------- the stance of everything else: the needle plate is in the head
  for (const s of SUBSYSTEMS) {
    G[s.id].userData.home = {
      position: G[s.id].position.clone(),
      quaternion: G[s.id].quaternion.clone(),
      scale: G[s.id].scale.clone(),
    };
  }

  // ---------------------------------------------------------- the pose
  const I = new THREE.Quaternion();
  const Q = new THREE.Quaternion();
  const O = new THREE.Vector3();
  const D = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const bowV = new THREE.Vector3();

  /** Presentation: a moved subsystem goes from home to the display point, turned and scaled, with a bow in the home frame. */
  function present(s, p) {
    const g = G[s.id];
    if (s.mode === 'inplace' || p <= 0) {
      g.position.set(0, 0, 0);
      g.quaternion.identity();
      g.scale.set(1, 1, 1);
      return;
    }
    const e = Math.min(1, Math.max(0, p));
    const [ox, oy, oz] = s.pivot;
    O.set(ox, oy, oz);
    D.set(...DISPLAY);
    Q.setFromEuler(new THREE.Euler(s.rot[0] * D2R, s.rot[1] * D2R, s.rot[2] * D2R));
    const R = I.clone().slerp(Q, e);
    const k = 1 + (s.scale - 1) * e;
    // (the presented size is sizes[id] × scale; the camera frames it from machine.sizes)
    sc.set(k, k, k);
    bowV.set(...s.out).multiplyScalar(Math.sin(Math.PI * e));
    // position so that the pivot O travels to D (rotation and scale about O)
    const RS = O.clone().applyQuaternion(R).multiplyScalar(k);
    g.position.copy(O).multiplyScalar(1).add(D.clone().sub(O).multiplyScalar(e)).add(bowV).sub(RS);
    g.quaternion.copy(R);
    g.scale.copy(sc);
  }

  /**
   * Pose everything for solution `sol` (from kin.solve) and presentation `open` ({id, p}). Pure: no state carried.
   */
  function update(sol, open = {id: null, p: 0}) {
    for (const s of SUBSYSTEMS) present(s, open.id === s.id ? open.p : 0);
    applyGhost(open.id, open.p);

    // balance wheel and band wheel: the belt's ratio, the crank pin's place on the band wheel
    const th = sol.theta * D2R;
    dyn.hand.rotation.x = th;
    dyn.band.rotation.x = sol.band.angleDeg * D2R;
    dyn.shaft.rotation.x = th;
    dyn.belt.material.map.offset.x = (((sol.theta * RATIO) / 360) * 2) % 1;
    dyn.spool.rotation.y = -th * 0.25;

    // the treadle rig rocks about its pivot line; the pitman follows its two joints
    dyn.treadle.rotation.x = sol.treadle.tiltDeg * D2R;
    const [, By, Bz] = sol.pitman.B;
    const [, Cy, Cz] = sol.pitman.C;
    const Bp = [DIM.treadle.jointX, By, Bz];
    const Cp = [DIM.treadle.pinX, Cy, Cz];
    setLink(dyn.pitmanRod, Bp, Cp);
    dyn.pitmanB.position.set(...Bp);
    dyn.pitmanC.position.set(...Cp);

    // the arm shaft's crank link to the needle bar
    const [pinY, pinZ] = sol.crankPin;
    const pinP = [DIM.needle.x + 0.04, pinY, pinZ];
    const jointP = [DIM.needle.x, sol.needle.jointY, DIM.needle.z];
    setLink(dyn.link, pinP, jointP);

    // the needle bar and needle
    const tipP = [DIM.needle.x, sol.needle.tipY, DIM.needle.z];
    setLink(dyn.needleBar, jointP, [DIM.needle.x, sol.needle.tipY + 0.018, DIM.needle.z]);
    dyn.clamp.position.set(DIM.needle.x, sol.needle.jointY - 0.012, DIM.needle.z);
    setLink(dyn.needle, [DIM.needle.x, sol.needle.tipY + 0.018, DIM.needle.z], tipP);

    // the take-up lever
    const P = [DIM.takeup.x, DIM.takeup.y, DIM.takeup.z];
    setLink(dyn.takeupLever, P, sol.takeup.eye);
    dyn.takeupEye.position.set(...sol.takeup.eye);
    dyn.takeupEye.rotation.set(Math.PI / 2, 0, 0);

    // the presser foot follows the lifter
    dyn.foot.position.y = sol.presser.soleY - DIM.presser.soleY;

    // the shuttle moves in its race and points along the race; the slide plate slides with its open
    dyn.shuttle.position.set(...sol.shuttle.point);
    // the boat's long axis is tangent to the race: a = 90° − β (its own +x points along the tangent)
    dyn.shuttle.rotation.set(0, (90 - sol.shuttle.betaDeg) * D2R, 0);
    const shuttleOpen = open.id === 'shuttle' ? open.p : 0;
    dyn.slidePlate.position.z = DIM.bed.z1 + 0.006 + shuttleOpen * 0.08;

    // the feed dog: its teeth rise through the plate, the dog moves forward and back
    dyn.dog.position.set(0, sol.feed.y - 0.004, sol.feed.z - DIM.feed.z);

    // the tension discs part as the tension regulator is opened
    const tOpen = open.id === 'tension_regulator' ? open.p : 0;
    dyn.discA.position.z = 0.075 - 0.004 - tOpen * 0.012;
    dyn.discB.position.z = 0.075 + 0.004 + tOpen * 0.012;

    // drawers slide 60 % open, the drop front lowers onto its hinge
    const dOpen = open.id === 'drawers' ? open.p : 0;
    for (const dg of dyn.drawers) dg.position.z = dOpen * 0.6 * 0.34;
    dyn.dropFront.rotation.x = dOpen * 88 * D2R;

    // the face plate swings toward the operator
    const hOpen = open.id === 'machine_head' ? open.p : 0;
    dyn.facePlate.rotation.y = -hOpen * 75 * D2R;

    // the thread: fixed guides, the take-up eye and the needle eye move with the machine
    const pts = sol.thread;
    for (let i = 0; i < dyn.thread.length; i++) setLink(dyn.thread[i], pts[i], pts[i + 1]);
    const phase = (sol.theta / 360) % 1;
    for (let i = 0; i < dyn.beads.length; i++) {
      const u = (phase + i / dyn.beads.length) % 1;
      const k = u * (pts.length - 1);
      const j = Math.min(pts.length - 2, Math.floor(k));
      const f = k - j;
      dyn.beads[i].position.set(
        pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f,
        pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f,
        pts[j][2] + (pts[j + 1][2] - pts[j][2]) * f,
      );
    }
    root.updateMatrixWorld(true);
  }

  /** Every group's transform as plain numbers (for the tests and the crosscheck). */
  function transforms() {
    const out = {};
    for (const s of SUBSYSTEMS) {
      const g = G[s.id];
      out[s.id] = {p: g.position.toArray(), q: g.quaternion.toArray(), s: g.scale.toArray()};
    }
    return out;
  }

  /** The home transform of every group, as numbers. */
  function homeTransforms() {
    const out = {};
    for (const s of SUBSYSTEMS) {
      const h = G[s.id].userData.home;
      out[s.id] = {p: h.position.toArray(), q: h.quaternion.toArray(), s: h.scale.toArray()};
    }
    return out;
  }

  return {root, groups: G, dyn, update, transforms, homeTransforms, sizes, beltLength: dyn.beltLength, ids: SUBSYSTEMS.map((s) => s.id), BY_ID};
}
