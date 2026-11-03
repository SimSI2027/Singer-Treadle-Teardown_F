// The film: the same machine, the same presenter and the same script as the page, rendered as a pure function of time
// (render(t)). The balance wheel's angle is read from a table computed once from the speed script, so a frame at t is
// the same frame however it is reached. capture.mjs steps it frame by frame into an mp4.
import {runSim} from '../kit/runtime.js';
import {createStage} from './stage.js';
import {createMachine} from './machine.js';
import {createConsole} from './console.js';
import {solve, cycleCurves, DIM} from './kin.js';
import {makeMaterials} from './materials.js';
import {stateAt} from './presenter.js';
import {EVENTS, DURATION, machineTable, captionAt} from './script.js';
import {cameraFor} from './live.js';
import {BY_ID} from './subsystems.js';

export const DEFAULTS = {
  duration: DURATION,
  fps: 60,
  theme: 'light',
  hud: {enabled: false, title: 'singer-treadle', subtitle: ''},
  director: {enabled: false},
  watermark: '',
};

const CSS = `
html,body{margin:0;background:#ecedef;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:1600px;height:900px}
#gl{position:absolute;left:0;top:0;width:1600px;height:900px;display:block}
`;

// the balance wheel's table: stepped at 1/240 s from the speed script (pure, computed once)
const TABLE = machineTable(1 / 240, DURATION + 1);
const DT = 1 / 240;
export function thetaAt(t) {
  const u = Math.max(0, Math.min(TABLE.length - 2, t / DT));
  const i = Math.floor(u);
  const a = TABLE[i];
  const b = TABLE[i + 1];
  const k = u - i;
  return {theta: a.theta + (b.theta - a.theta) * k, rpm: a.rpm + (b.rpm - a.rpm) * k};
}

export function makeFilm() {
  return async ({canvas, capture}) => {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const app = document.getElementById('app');
    const stage = createStage(canvas, {view: {width: 1600, height: 900}});
    stage.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    const M = makeMaterials();
    const machine = createMachine(M);
    stage.scene.add(machine.root);
    const ui = createConsole(app);
    const curves = cycleCurves(360, DIM.feed.S);
    ui.buildStrip(curves);
    const orbit = {az: 0, el: 0, zoom: 1};

    return {
      warm: () => stage.warm(),
      resize: () => stage.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2)),
      render(t) {
        const {theta, rpm} = thetaAt(t);
        const sol = solve({theta, rpm, stitchMM: DIM.feed.S, presserUp: 0, tension: 0.5});
        const state = stateAt(t, EVENTS, {id: null, p: 0});
        machine.update(sol, {id: state.id ?? null, p: state.p ?? 0});
        stage.frame(cameraFor(state, orbit, t, true, machine.sizes));
        let callouts = null;
        if (state.id && state.p > 0.3) {
          const g = machine.groups[state.id];
          g.updateMatrixWorld(true);
          callouts = BY_ID[state.id].callouts.map((c) => {
            const p = stage.project(new stage.THREE.Vector3(...c.at).applyMatrix4(g.matrixWorld));
            return {label: c.label, sub: c.sub, at: [p.x, p.y]};
          });
        }
        ui.update({
          sol,
          running: rpm > 5,
          pumping: false,
          presserUp: 0,
          stitchMM: DIM.feed.S,
          spm: rpm,
          openId: state.id ?? null,
          openP: state.p ?? 0,
          hoverId: null,
          callouts,
          caption: captionAt(t),
          tour: true,
          hintText: '',
          curves,
          onGo: () => {},
        });
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
