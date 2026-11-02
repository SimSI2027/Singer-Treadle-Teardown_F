// Web edition of the Teardown exhibit.
//
// Loads the same voxels the mod loads (assets/geometry.bin, written by tools/generate.py) and the
// same CONFIG / SUBSYSTEMS / GEOM tables (assets/exhibit.json, read out of exhibit.lua by
// tools/run_tests.py), and runs a line-for-line port of exhibit.lua's pose functions and state
// machine. Nothing here is keyframed: every pose is a function of the exhibit clock.
//
// URL parameters (used by tools/screens/capture.mjs for the screenshots):
//   ?show=<id>&sway=<s>   jump to SHOWN          ?open=<id>&t=<s>   freeze OPENING at t
//   ?run=<s>              freeze RUN at s        ?cam=hero|console|display|side|top
//   ?freeze=1             stop the clock         ?tour=0            no auto tour
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const D2R = Math.PI / 180;
const params = new URLSearchParams(location.search);
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeInOutCubic = (x) => { const k = clamp01(x); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const smoothstep = (x) => { const k = clamp01(x); return k * k * (3 - 2 * k); };
const prog = (t, t0, t1) => easeInOutCubic((t - t0) / (t1 - t0));
const lin = (t, t0, t1) => clamp01((t - t0) / (t1 - t0));
const arr = (v) => (Array.isArray(v) ? v : []);

// ---------------------------------------------------------------- transform helpers (Teardown semantics)
const T = (pos, rot) => ({pos, rot});
const quatEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x * D2R, y * D2R, z * D2R, 'YZX'));
const quatAxis = (axis, deg) => new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), deg * D2R);
function toParent(parent, child) {
  return T(child.pos.clone().applyQuaternion(parent.rot).add(parent.pos), parent.rot.clone().multiply(child.rot));
}
function toLocal(parent, t) {
  const inv = parent.rot.clone().invert();
  return T(t.pos.clone().sub(parent.pos).applyQuaternion(inv), inv.clone().multiply(t.rot));
}
function rotAbout(p, axis, deg) {
  const q = quatAxis(axis, deg);
  return T(p.clone().sub(p.clone().applyQuaternion(q)), q);
}
function bezier(p0, p1, p2, p3, u) {
  const a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, d = u ** 3;
  return new THREE.Vector3(
    a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    a * p0.z + b * p1.z + c * p2.z + d * p3.z);
}
const apply = (obj, t) => { obj.position.copy(t.pos); obj.quaternion.copy(t.rot); };

// ---------------------------------------------------------------- boot
export async function boot(opts) {
  const {canvas, onState, onHover, onReady} = opts;
  const [meta, blob, exh] = await Promise.all([
    fetch('assets/geometry.json').then((r) => r.json()),
    fetch('assets/geometry.bin').then((r) => r.arrayBuffer()),
    fetch('assets/exhibit.json').then((r) => r.json()),
  ]);
  const CFG = exh.CONFIG, SUBS = exh.SUBSYSTEMS, GEOM = exh.GEOM;
  const bytes = new Uint8Array(blob);

  // ---------------------------------------------------------------- renderer + stage
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9e1d2');
  scene.fog = new THREE.Fog('#e9e1d2', 7, 16);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 60);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.6;
  controls.maxDistance = 7;
  controls.maxPolarAngle = 88 * D2R;

  const hemi = new THREE.HemisphereLight('#fff6e6', '#6b5a48', 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#fff1dc', 2.1);
  key.position.set(2.6, 4.2, 3.0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {left: -2.4, right: 2.4, top: 2.4, bottom: -1.2, near: 0.5, far: 12});
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.01;
  scene.add(key);
  const warm = new THREE.PointLight('#ffcf9a', 1.6, 3.2, 1.6);     // the display lamp (prefab light #1)
  warm.position.set(...meta.anchors.display.map((v, i) => (i === 1 ? v + 1.0 : v)));
  scene.add(warm);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({color: '#8a6f55', roughness: 0.85}));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ---------------------------------------------------------------- voxel meshes
  const pal = {};
  for (const [idx, p] of Object.entries(meta.palette)) pal[idx] = {color: new THREE.Color(p.rgb).convertSRGBToLinear(), kind: p.kind};
  const mats = {
    metal: new THREE.MeshStandardMaterial({vertexColors: true, metalness: 0.55, roughness: 0.42, envMapIntensity: 0.6}),
    matte: new THREE.MeshStandardMaterial({vertexColors: true, metalness: 0.0, roughness: 0.78, envMapIntensity: 0.4}),
  };
  const FACES = [
    [1, 0, 0, [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]], [-1, 0, 0, [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]],
    [0, 1, 0, [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]], [0, -1, 0, [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
    [0, 0, 1, [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]]], [0, 0, -1, [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]],
  ];
  // shape voxels -> merged, face-culled geometry per material kind, vertices in the body frame (metres)
  function shapeMeshes(s, emissiveMat) {
    const [ox, oy, oz] = s.origin_cm;
    const occ = new Set();
    const vox = [];
    for (let i = 0; i < s.count; i++) {
      const o = s.offset + 4 * i;
      const x = bytes[o] + ox, y = bytes[o + 1] + oy, z = bytes[o + 2] + oz, c = bytes[o + 3];
      vox.push([x, y, z, c]);
      occ.add(x + ',' + y + ',' + z);
    }
    const buckets = {};
    for (const [x, y, z, c] of vox) {
      const p = pal[c];
      const kind = p.kind;
      const b = (buckets[kind] ||= {pos: [], nor: [], col: [], idx: []});
      for (const [nx, ny, nz, quad] of FACES) {
        if (occ.has((x + nx) + ',' + (y + ny) + ',' + (z + nz))) continue;
        const base = b.pos.length / 3;
        // a touch of per-face shading reads like ambient occlusion on the voxel steps
        const shade = ny > 0 ? 1.0 : ny < 0 ? 0.62 : nx !== 0 ? 0.86 : 0.93;
        for (const [qx, qy, qz] of quad) {
          b.pos.push((x + qx) / 100, (y + qy) / 100, (z + qz) / 100);
          b.nor.push(nx, ny, nz);
          b.col.push(p.color.r * shade, p.color.g * shade, p.color.b * shade);
        }
        b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const out = [];
    for (const [kind, b] of Object.entries(buckets)) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      g.setIndex(b.idx);
      const m = new THREE.Mesh(g, kind === 'emit' ? emissiveMat : mats[kind]);
      m.castShadow = true;
      m.receiveShadow = true;
      out.push(m);
    }
    return out;
  }

  const bodies = {};          // body name -> Object3D
  const artShapes = {};       // art tag -> [Object3D]
  const buttonMeshes = [];
  const buttonMat = {};       // btn id -> material
  for (const s of meta.shapes) {
    let body = bodies[s.body];
    if (!body) {
      body = bodies[s.body] = new THREE.Group();
      body.name = s.body;
      scene.add(body);
    }
    let emissive = null;
    if (s.tags.btn) {
      emissive = new THREE.MeshStandardMaterial({vertexColors: true, metalness: 0.5, roughness: 0.35, emissive: new THREE.Color('#ffb54a'), emissiveIntensity: 0.0});
      buttonMat[s.tags.btn] = emissive;
    }
    const holder = new THREE.Group();
    for (const m of shapeMeshes(s, emissive || mats.metal)) {
      if (s.tags.btn) { m.userData.btn = s.tags.btn; buttonMeshes.push(m); }
      holder.add(m);
    }
    body.add(holder);
    if (s.tags.art) (artShapes[s.tags.art] ||= []).push(holder);
  }
  const machineHome = T(V3(meta.anchors.machine), new THREE.Quaternion());
  const shiftPos = V3(meta.anchors.shift);
  const displayPos = V3(meta.anchors.display);
  const up = new THREE.Vector3(0, 1, 0);
  for (const name of Object.keys(bodies)) {
    if (name !== 'console_plate' && name !== 'plinth') apply(bodies[name], machineHome);
  }

  // ---------------------------------------------------------------- runtime records (as exhibit.lua init)
  function buildPath(legs) {
    const path = {pts: [new THREE.Vector3()], cum: [0], total: 0, dir: up.clone(), finish: new THREE.Vector3()};
    const acc = new THREE.Vector3();
    for (const leg of arr(legs)) {
      const w = V3(leg);
      const l = w.length();
      if (l > 0) {
        acc.add(w);
        path.total += l;
        path.pts.push(acc.clone());
        path.cum.push(path.total);
        path.dir = w.clone().multiplyScalar(1 / l);
      }
    }
    path.finish = acc.clone();
    return path;
  }
  function pathAt(path, u) {
    if (path.total <= 0 || u <= 0) return new THREE.Vector3();
    if (u >= 1) return path.finish.clone();
    const d = u * path.total;
    for (let i = 1; i < path.pts.length; i++) {
      if (d <= path.cum[i]) {
        const k = (d - path.cum[i - 1]) / (path.cum[i] - path.cum[i - 1]);
        return path.pts[i - 1].clone().lerp(path.pts[i], easeInOutCubic(k));
      }
    }
    return path.finish.clone();
  }
  const bodyOfId = meta.body_of_id;
  const recs = SUBS.map((def) => {
    const home = T(machineHome.pos.clone(), machineHome.rot.clone());
    const rec = {id: def.id, def, obj: bodies[bodyOfId[def.id]], home};
    rec.localOffset = toLocal(machineHome, home);
    rec.centerLocal = V3(GEOM.center[def.id]);
    rec.centerHome = rec.centerLocal.clone().applyQuaternion(home.rot).add(home.pos);
    rec.exitPath = buildPath(def.exit || [[0, 0.1, 0]]);
    rec.makewayPath = buildPath(def.makeway !== undefined ? def.makeway : def.exit);
    rec.outW = def.out ? V3(def.out) : rec.exitPath.dir.clone().multiplyScalar(CFG.OUT_LEN).add(up.clone().multiplyScalar(CFG.OUT_RISE));
    rec.displayW = displayPos.clone().add(V3(def.offset || [0, 0, 0]));
    rec.approachW = V3(def.approach || CFG.APPROACH);
    const p = def.pose || [0, 0, 0];
    rec.displayRot = quatEuler(p[0], p[1], p[2]);
    return rec;
  });
  const byId = Object.fromEntries(recs.map((r) => [r.id, r]));

  // ---------------------------------------------------------------- poses (port of exhibit.lua section 5)
  const windows = (rec) => rec.def.frame
    ? [...(rec.def.lift || [CFG.FRAME_LIFT_START, CFG.FRAME_LIFT_END]), CFG.FRAME_SHIFT_START, CFG.FRAME_SHIFT_END]
    : [CFG.LIFT_START, CFG.LIFT_END, CFG.SHIFT_START, CFG.SHIFT_END];
  function groupTransform(rec, s, makeway) {
    const pos = machineHome.pos.clone().lerp(shiftPos, s);
    const t = toParent(T(pos, machineHome.rot), rec.localOffset);
    if (makeway) t.pos.add(makeway);
    return t;
  }
  function selectedTransform(rec, t, yaw) {
    const [l0, l1] = windows(rec);
    const pres = prog(t, CFG.PRESENT_START, CFG.PRESENT_END);
    let p;
    if (pres <= 0) p = rec.centerHome.clone().add(pathAt(rec.exitPath, lin(t, l0, l1)));
    else {
      const lifted = rec.centerHome.clone().add(rec.exitPath.finish);
      p = bezier(lifted, lifted.clone().add(rec.outW), rec.displayW.clone().add(rec.approachW), rec.displayW, pres);
    }
    let q = rec.home.rot.clone().slerp(rec.displayRot, pres);
    if (yaw !== 0) q = quatAxis(up, yaw * pres).multiply(q);
    return T(p.clone().sub(rec.centerLocal.clone().applyQuaternion(q)), q);
  }
  const PIVOTS = {dropfront_hinge: [0, 0.64, 0.22]};
  function applyArticulation(rec, k) {
    for (const a of arr(rec.def.art)) {
      for (const obj of artShapes[a.art] || []) {
        let delta;
        if (a.deg !== undefined) delta = rotAbout(V3(GEOM.kin[a.pivot] || PIVOTS[a.pivot]), V3(a.axis), a.deg * k);
        else delta = T(V3(a.move).multiplyScalar(k), new THREE.Quaternion());
        apply(obj, delta);
      }
    }
  }
  function resetArticulation() {
    for (const list of Object.values(artShapes)) for (const o of list) apply(o, T(new THREE.Vector3(), new THREE.Quaternion()));
  }
  function applyOpenPose(id, t, yaw) {
    const sel = byId[id];
    const [, , s0, s1] = windows(sel);
    const s = prog(t, s0, s1);
    for (const rec of recs) {
      if (rec.id === id) apply(rec.obj, selectedTransform(rec, t, yaw));
      else {
        let off = null;
        if (sel.def.frame) {
          const d = rec.def.makewayDelay || 0;
          off = pathAt(rec.makewayPath, lin(t, CFG.LIFT_START + d * (CFG.LIFT_END - CFG.LIFT_START), CFG.LIFT_END));
        }
        apply(rec.obj, groupTransform(rec, s, off));
      }
    }
    applyArticulation(sel, prog(t, CFG.ARTICULATE_START, CFG.ARTICULATE_END));
  }
  function snapHome() {
    for (const rec of recs) apply(rec.obj, rec.home);
    resetArticulation();
  }
  function runAngle(t) {
    const Tt = CFG.RUN_TIME, a = CFG.RUN_RAMP, total = 2 * Math.PI * CFG.RUN_TURNS, w = total / (Tt - a);
    if (t <= 0) return 0;
    if (t >= Tt) return total;
    if (t < a) return w * t * t / (2 * a);
    if (t < Tt - a) return w * a / 2 + w * (t - a);
    const r = Tt - t;
    return total - w * r * r / (2 * a);
  }
  const K = GEOM.kin;
  let prevStud = null;
  function solveStud(A, prev) {
    const P = [K.treadle_pivot[2], K.treadle_pivot[1]];
    const r0 = K.stud_r, r1 = K.pitman_len;
    const dz = A[0] - P[0], dy = A[1] - P[1], d = Math.hypot(dz, dy);
    const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
    const mz = P[0] + a * dz / d, my = P[1] + a * dy / d;
    const s1 = [mz + h * dy / d, my - h * dz / d], s2 = [mz - h * dy / d, my + h * dz / d];
    const e = (s) => (s[0] - prev[0]) ** 2 + (s[1] - prev[1]) ** 2;
    return e(s1) <= e(s2) ? s1 : s2;
  }
  const psi = (z, y) => Math.atan2(y, z) / D2R;
  const X = new THREE.Vector3(1, 0, 0);
  function applyRunPose(theta) {
    const arm = theta * K.belt_ratio;
    for (const o of artShapes.band_wheel || []) apply(o, rotAbout(V3(K.band_axis), X, theta / D2R));
    const ang = K.crank_phase - theta;
    const A = [K.band_axis[2] + K.crank_r * Math.cos(ang), K.band_axis[1] + K.crank_r * Math.sin(ang)];
    const A0 = [K.crank_pin0[2], K.crank_pin0[1]], B0 = [K.stud0[2], K.stud0[1]];
    const B = solveStud(A, prevStud || B0);
    prevStud = B;
    const P = [K.treadle_pivot[2], K.treadle_pivot[1]];
    const dT = psi(B0[0] - P[0], B0[1] - P[1]) - psi(B[0] - P[0], B[1] - P[1]);
    apply(byId.treadle.obj, toParent(byId.treadle.home, rotAbout(V3(K.treadle_pivot), X, dT)));
    const dP = psi(A0[0] - B0[0], A0[1] - B0[1]) - psi(A[0] - B[0], A[1] - B[1]);
    const q = quatAxis(X, dP);
    const b0 = V3(K.stud0), b = new THREE.Vector3(K.stud0[0], B[1], B[0]);
    apply(byId.pitman_rod.obj, toParent(byId.pitman_rod.home, T(b.clone().sub(b0.clone().applyQuaternion(q)), q)));
    for (const id of ['drive_wheel', 'crankshaft']) apply(byId[id].obj, toParent(byId[id].home, rotAbout(V3(K.hand_axis), X, arm / D2R)));
    const dy = -K.needle_crank_r * (1 - Math.cos(arm));
    apply(byId.needle_assembly.obj, toParent(byId.needle_assembly.home, T(new THREE.Vector3(0, dy, 0), new THREE.Quaternion())));
    for (const o of artShapes.boat || []) apply(o, rotAbout(V3(K.shuttle_pivot), X, CFG.SHUTTLE_SWING_DEG * Math.sin(arm)));
    for (const o of artShapes.feed_dog || []) apply(o, T(new THREE.Vector3(0, CFG.FEED_LIFT * Math.max(0, Math.sin(arm)), -CFG.FEED_TRAVEL * 0.5 * Math.cos(arm)), new THREE.Quaternion()));
  }

  // ---------------------------------------------------------------- state machine (port of section 6)
  const st = {mode: 'IDLE', id: null, t: 0, sway: 0, yaw0: 0, queued: null};
  const startOpen = (id) => Object.assign(st, {mode: 'OPENING', id, t: 0, sway: 0, yaw0: 0});
  const startRun = () => { Object.assign(st, {mode: 'RUN', id: null, t: 0}); prevStud = null; };
  function startClose() {
    if (st.mode === 'SHOWN') st.yaw0 = CFG.SWAY_DEG * Math.sin(st.sway * CFG.SWAY_RATE);
    st.mode = 'CLOSING';
  }
  function press(id) {
    if (id === 'reset') {
      st.queued = null;
      if (st.mode === 'OPENING' || st.mode === 'SHOWN') startClose();
      return;
    }
    if (st.mode === 'IDLE') { if (id === 'run') startRun(); else if (byId[id]) startOpen(id); }
    else if (st.mode === 'SHOWN') { if (id !== st.id) st.queued = id; startClose(); }
  }
  function step(dt) {
    if (st.mode === 'OPENING') {
      st.t += dt;
      if (st.t >= CFG.OPEN_TIME) { st.t = CFG.OPEN_TIME; st.mode = 'SHOWN'; st.sway = 0; }
      applyOpenPose(st.id, st.t, 0);
    } else if (st.mode === 'SHOWN') {
      st.sway += dt;
      applyOpenPose(st.id, CFG.OPEN_TIME, CFG.SWAY_DEG * Math.sin(st.sway * CFG.SWAY_RATE));
    } else if (st.mode === 'CLOSING') {
      st.t -= dt;
      if (st.t <= 0) {
        snapHome();
        Object.assign(st, {mode: 'IDLE', id: null, t: 0, yaw0: 0});
        const q = st.queued;
        st.queued = null;
        if (q === 'run') startRun(); else if (q) startOpen(q);
      } else applyOpenPose(st.id, st.t, st.yaw0);
    } else if (st.mode === 'RUN') {
      st.t += dt;
      if (st.t >= CFG.RUN_TIME) { snapHome(); Object.assign(st, {mode: 'IDLE', t: 0}); }
      else applyRunPose(runAngle(st.t));
    }
  }

  // ---------------------------------------------------------------- cameras
  const CAMS = {
    hero: {pos: [-1.55, 1.9, 3.35], target: [-0.05, 0.72, 0.5]},
    console: {pos: [1.25, 1.55, 2.25], target: [0.85, 0.97, 1.5]},
    display: {pos: [0.35, 1.5, 2.85], target: [0.3, 0.98, 1.15]},
    side: {pos: [-2.8, 1.5, 2.4], target: [-0.4, 0.7, 0.3]},
    top: {pos: [0.4, 4.2, 2.2], target: [-0.3, 0.4, 0.5]},
    machine: {pos: [0.95, 1.35, 1.35], target: [0.0, 0.85, 0.0]},
  };
  // camera glide: a goal the camera eases toward (cancelled by any drag or scroll)
  let glide = null;          // {pos, target}
  let autoFramed = false;    // true while the camera was moved by the exhibit, not the visitor
  function setCam(name, instant = true) {
    const c = CAMS[name] || CAMS.hero;
    if (instant) {
      camera.position.set(...c.pos);
      controls.target.set(...c.target);
      controls.update();
      glide = null;
    } else glide = {pos: V3(c.pos), target: V3(c.target)};
  }
  // frame a subsystem at the display point: distance from its size, slightly off-centre so the
  // info panel on the right never covers it
  function frameFor(id) {
    const b = meta.bounds_m[id];
    const r = 0.5 * Math.hypot(b[1][0] - b[0][0], b[1][1] - b[0][1], b[1][2] - b[0][2]);
    const dist = Math.min(3.4, Math.max(0.75, r * 3.1));
    const rec = byId[id];
    const centre = rec.displayW.clone();
    const dir = new THREE.Vector3(0.28, 0.34, 1).normalize();
    const right = new THREE.Vector3(1, 0, -0.28).normalize();
    const target = centre.clone().add(right.multiplyScalar(dist * 0.17));
    return {pos: target.clone().add(dir.multiplyScalar(dist)), target};
  }
  const camParam = params.get('cam') || 'hero';
  setCam(camParam === 'auto' ? 'hero' : camParam);

  // ---------------------------------------------------------------- hover + click on the 3D console
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hover = null;
  let downAt = null;
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(buttonMeshes, false)[0];
    const h = hit ? hit.object.userData.btn : null;
    if (h !== hover) { hover = h; canvas.style.cursor = h ? 'pointer' : ''; onHover && onHover(h); }
  });
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; userActed(); });
  canvas.addEventListener('pointerup', (e) => {
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 5 && hover) api.press(hover);
    downAt = null;
  });
  canvas.addEventListener('wheel', userActed, {passive: true});

  // ---------------------------------------------------------------- auto tour (reference kit convention: hands back after quiet)
  const TOUR = ['needle_assembly', 'shuttle', 'treadle', 'belt_drive', 'gear_train', 'tension_regulator', 'run', 'machine_head', 'drawers'];
  let tourOn = params.get('tour') !== '0' && !params.has('show') && !params.has('open') && !params.has('run');
  let quiet = 0, tourIdx = 0, tourHold = 0;
  function userActed() { quiet = 0; glide = null; autoFramed = false; if (tourOn) { tourOn = false; onState && onState(api.state()); } }
  function tour(dt) {
    quiet += dt;
    if (!tourOn && quiet > 30 && params.get('tour') !== '0') tourOn = true;
    if (!tourOn) return;
    if (st.mode === 'IDLE') {
      tourHold += dt;
      if (tourHold > 2.0) { tourHold = 0; press(TOUR[tourIdx++ % TOUR.length]); }
    } else if (st.mode === 'SHOWN') {
      tourHold += dt;
      if (tourHold > 7.5) { tourHold = 0; press('reset'); }
    } else tourHold = 0;
  }

  // ---------------------------------------------------------------- deep links for screenshots
  const freeze = params.get('freeze') === '1';
  if (params.has('show')) { const id = params.get('show'); startOpen(id); step(CFG.OPEN_TIME); st.sway = 0; step(+params.get('sway') || 0.0001); }
  if (params.has('open')) { startOpen(params.get('open')); step(+params.get('t') || 1.0); }
  if (params.has('run')) { startRun(); const tt = +params.get('run') || 2; for (let x = 0; x < tt; x += 1 / 60) step(Math.min(1 / 60, tt - x)); }
  if (camParam === 'auto' && st.id) {
    const f = frameFor(st.id);
    camera.position.copy(f.pos);
    controls.target.copy(f.target);
    controls.update();
  }

  // ---------------------------------------------------------------- loop
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }
  let last = performance.now();
  let lastMode = '';
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!freeze) { tour(dt); step(dt); }
    // one accent: only the active button glows; hover gets a softer glow
    const active = st.mode === 'RUN' ? 'run' : st.id;
    for (const [id, m] of Object.entries(buttonMat)) m.emissiveIntensity = id === active ? 0.9 : id === hover ? 0.35 : 0.04;
    const key2 = st.mode + st.id;
    if (key2 !== lastMode) {
      // the exhibit moves the camera only if the visitor has not taken it
      if (st.mode === 'OPENING' && (autoFramed || tourOn || params.get('follow') !== '0')) { glide = frameFor(st.id); autoFramed = true; }
      if (st.mode === 'IDLE' && autoFramed) { setCam('hero', false); autoFramed = false; }
      lastMode = key2;
      onState && onState(api.state());
    }
    if (glide && !freeze) {
      const k = 1 - Math.exp(-dt * 2.2);
      camera.position.lerp(glide.pos, k);
      controls.target.lerp(glide.target, k);
      if (camera.position.distanceTo(glide.pos) < 0.002) glide = null;
    }
    resize();
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  const api = {
    press: (id) => { userActed(); press(id); onState && onState(api.state()); },
    state: () => ({mode: st.mode, id: st.id, queued: st.queued, tour: tourOn, t: st.t, sway: st.sway}),
    subsystems: SUBS,
    config: CFG,
    setCam: (name) => { userActed(); setCam(name, false); },
    panelAlpha: () => (st.mode === 'SHOWN' ? smoothstep((st.sway - CFG.PANEL_DELAY) / CFG.PANEL_FADE) : 0),
  };
  requestAnimationFrame((t) => { last = t; frame(t); });
  // two frames so the first screenshot already shows the machine
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; onReady && onReady(api); }));
  return api;
}
