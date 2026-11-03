// Materials for the machine: japanned cast iron, nickel and steel, gold decal, oak, brass, belt leather, thread, rubber.
// Procedural textures (oak grain, belt, decal lettering) are drawn on canvases at load: nothing is fetched.
import * as THREE from 'three';
import {rng} from '../kit/util.js';

const canvas = (w, h, draw) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

/** Oak: long grain with a soft figure, drawn from a seeded PRNG so every load is the same board. */
export function oakTexture() {
  return canvas(512, 512, (g, w, h) => {
    const r = rng(20260501);
    g.fillStyle = '#b07a48';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const y = r() * h;
      const amp = 2 + r() * 6;
      const f = 0.004 + r() * 0.01;
      const ph = r() * 6.28;
      g.strokeStyle = `rgba(${70 + r() * 40},${40 + r() * 20},${18},${0.05 + r() * 0.16})`;
      g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const yy = y + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph) * amp * 0.25;
        x ? g.lineTo(x, yy) : g.moveTo(x, yy);
      }
      g.stroke();
    }
  });
}

/** Belt leather: a faint lengthwise grain plus cross stitches the flow animation can scroll past. */
export function beltTexture() {
  return canvas(256, 64, (g, w, h) => {
    const r = rng(7);
    g.fillStyle = '#a8703f';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(60,30,10,${0.05 + r() * 0.12})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 10, 1);
    }
    g.fillStyle = 'rgba(255,240,210,0.35)';
    for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 2, h);
  });
}

/** The gold decal: a scroll-lettered name in a serif, on a transparent ground. */
export function decalTexture(text = 'SINGER') {
  return canvas(512, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = 'italic 700 64px Georgia, "Times New Roman", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#e2b960';
    g.strokeStyle = '#5a3d10';
    g.lineWidth = 3;
    g.strokeText(text, w / 2, h / 2 + 2);
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

export function makeMaterials() {
  const oak = oakTexture();
  const M = {
    japan: new THREE.MeshPhysicalMaterial({color: '#15161a', roughness: 0.34, metalness: 0.35, clearcoat: 0.75, clearcoatRoughness: 0.2}),
    iron: new THREE.MeshStandardMaterial({color: '#2b2d33', roughness: 0.5, metalness: 0.6}),
    nickel: new THREE.MeshStandardMaterial({color: '#d4d8de', roughness: 0.18, metalness: 1}),
    steel: new THREE.MeshStandardMaterial({color: '#aeb4bc', roughness: 0.26, metalness: 1}),
    gold: new THREE.MeshStandardMaterial({color: '#c9a04c', roughness: 0.28, metalness: 1}),
    brass: new THREE.MeshStandardMaterial({color: '#c39a45', roughness: 0.3, metalness: 1}),
    oak: new THREE.MeshStandardMaterial({color: '#ffffff', map: oak, roughness: 0.62, metalness: 0}),
    oakDark: new THREE.MeshStandardMaterial({color: '#7d5230', roughness: 0.7, metalness: 0}),
    belt: new THREE.MeshStandardMaterial({color: '#ffffff', map: beltTexture(), roughness: 0.8, metalness: 0}),
    thread: new THREE.MeshStandardMaterial({color: '#c8102e', roughness: 0.45, metalness: 0}),
    rubber: new THREE.MeshStandardMaterial({color: '#1c1c1e', roughness: 0.9, metalness: 0}),
    wood: new THREE.MeshStandardMaterial({color: '#c7a071', roughness: 0.7, metalness: 0}),
    felt: new THREE.MeshStandardMaterial({color: '#5e4d3c', roughness: 1, metalness: 0}),
    decal: new THREE.MeshStandardMaterial({color: '#ffffff', map: decalTexture(), transparent: true, roughness: 0.3, metalness: 0.8, depthWrite: false}),
    white: new THREE.MeshStandardMaterial({color: '#e8e6e1', roughness: 0.6, metalness: 0}),
  };
  // one ghost per material for the "rest of the machine" dimming: the same look, see-through, no depth writes
  M.ghost = {};
  for (const [k, m] of Object.entries(M)) {
    if (k === 'ghost') continue;
    const g = m.clone();
    g.transparent = true;
    g.depthWrite = false;
    g.opacity = 1;
    M.ghost[k] = g;
  }
  return M;
}
