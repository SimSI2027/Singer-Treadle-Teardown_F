// The stage: a pale studio (the skill's light-studio rule: pale backdrop, black iron reads through soft boxes), a soft
// shadow on an invisible floor, and a camera rig. frame(cam) draws one frame; cam = {target, az, el, d} in metres and
// degrees (az 0 is the operator's side, +z). Quality tiers (kit/warm.js compiles every program before the first frame).
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {warmComposer} from '../kit/warm.js';

export const BG = {top: '#f3f3f4', mid: '#e9eaec', low: '#e3e4e6'};
const D2R = Math.PI / 180;

export function createStage(canvas, {view = {width: 1600, height: 900}} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 512;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, BG.top);
    gr.addColorStop(0.55, BG.mid);
    gr.addColorStop(1, BG.low);
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;
  }

  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 0.02, 60);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 4}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.7;
  gtao.updateGtaoMaterial({radius: 0.05, distanceExponent: 1.4, thickness: 0.6, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16});
  composer.addPass(gtao);
  composer.addPass(new OutputPass());

  // a soft studio for the gloss to read: a top soft box, two side strips and a low fill, baked once into an environment
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#d9dadd');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(12, 12, new THREE.Vector3(0, 14, 2), 2.6);
    box(3, 14, new THREE.Vector3(-12, 4, 6), 3.4);
    box(3, 14, new THREE.Vector3(12, 4, -4), 2.2);
    box(18, 2, new THREE.Vector3(0, 2, 14), 1.6);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 0.9;
    pm.dispose();
  }
  const sun = new THREE.DirectionalLight('#ffffff', 2.0);
  sun.position.set(-1.2, 3.2, 1.6);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {left: -1.1, right: 1.1, top: 1.1, bottom: -1.1, near: 0.5, far: 9});
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 12;
  sun.shadow.blurSamples = 20;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.002;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#cfd0d3', 0.6));

  const FLOOR_Y = -0.001;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.ShadowMaterial({color: '#5d636c', opacity: 0.26, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  scene.add(floor);

  // the view: the 1600 x 900 layout, with the machine centred in the part the panels leave free
  const size = {w: view.width, h: view.height};
  let shiftY = 0; // CSS px: positive moves the subject up the screen
  const applyView = () => {
    camera.setViewOffset(size.w, size.h, 0, shiftY * (size.h / 900), size.w, size.h);
    camera.updateProjectionMatrix();
  };
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    applyView();
  };
  const setShift = (px) => {
    shiftY = px;
    applyView();
  };

  const pv = new THREE.Vector3();
  /** A world point on screen, in CSS px of the 1600 x 900 layout, and whether it is in front of the camera. */
  const project = (p) => {
    pv.set(p.x ?? p[0], p.y ?? p[1], p.z ?? p[2]).project(camera);
    return {x: (pv.x * 0.5 + 0.5) * size.w, y: (-pv.y * 0.5 + 0.5) * size.h, visible: pv.z < 1};
  };

  /** One frame. cam: {target [x,y,z], az deg, el deg, d m}. */
  const frame = (cam) => {
    const t = cam.target;
    const az = cam.az * D2R;
    const el = cam.el * D2R;
    camera.position.set(t[0] + cam.d * Math.cos(el) * Math.sin(az), t[1] + cam.d * Math.sin(el), t[2] + cam.d * Math.cos(el) * Math.cos(az));
    camera.lookAt(t[0], t[1], t[2]);
    camera.updateMatrixWorld();
    // the sun follows the view so the subject is always lit from the same side
    sun.position.set(t[0] - 1.2, t[1] + 3.2, t[2] + 1.6);
    sun.target.position.set(t[0], t[1], t[2]);
    sun.target.updateMatrixWorld();
    composer.render();
  };

  const setQuality = ({ao, pixelRatio, shadow}) => {
    if (ao !== undefined) gtao.enabled = ao;
    if (shadow !== undefined && sun.shadow.mapSize.x !== shadow) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    if (pixelRatio !== undefined) renderer.setPixelRatio(pixelRatio);
  };

  /** Compile every program before the first frame (kit/warm.js). Resolves when the GPU has them all. */
  const warm = () => warmComposer(renderer, composer, scene, camera);

  return {THREE, renderer, scene, camera, composer, gtao, sun, resize, setShift, project, frame, setQuality, warm, size, FLOOR_Y};
}
