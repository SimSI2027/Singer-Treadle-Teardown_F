# CONVENTIONS: what the teardown skill does, and what this exhibit follows

This project is built on the `elvarofficial/teardown` Claude Code skill, installed at
`~/.claude/skills/teardown` (`SKILL.md`, `sims/`, `sfx/`, `paths.mjs`). The kit, the capture and build scripts and the sound
engine are **vendored** into this repository (`sims/kit/`, `sims/build.mjs`, `sims/capture.mjs`, `sfx/`, `paths.mjs`,
`run_sfx.py`, `sheet.mjs`, `wave.mjs`), with the same content as the skill (checked with `diff -r`; git normalises line endings), so a clone builds without the skill.

Every section below quotes the skill's own file and line. Where the skill is silent, the entry says
**NOT FOUND — using fallback** and states the fallback. Where this project departs from the skill, see
[Deviations](#deviations).

---

## a) Machine structure: what goes where

`SKILL.md` ("How a machine is built"), table:

| File | Job (quoted) |
|---|---|
| `kin.js` / `gear.js` / `jansen.js` | "The math. Real dimensions in real units, one input … and every pose and readout as a function of it. No three.js in here." |
| `engine.js` / `gear.js` / `beast.js` | "The geometry, built from code … `update(input)` poses it." |
| `stage.js` | "Studio, lights, shadows, post … `frame(state, cam)` draws one frame." |
| `console.js` | "The overlay: fixed 1600 x 900 CSS layout … `update(state)` redraws it." |
| `film.js` | "A `SCRIPT` of operator moves … and `render(t)` as a pure function of time." |
| `live.js` | "The same machine in real time … any click, drag, wheel or key hands control over, 25 s of quiet hands it back." |
| `score.py` | "The sound on the film's timeline." |

Module exports in the reference machines:

- `sims/v8-shared/engine.js:119` `export function buildEngine(opts = {})`
- `sims/v8-shared/stage.js:19` `export function createV8Stage({canvas, look = {}})`
- `sims/v8-shared/console.js:31` `export function createConsole(app)`
- `sims/v8-shared/film.js:239` `export const run = () => runSim(DEFAULTS, makeFilm());`
- `sims/v8-shared/live.js:44` `export function runLive()`

**Parts, state and numbers.** The reference machines expose their parts through the `update(input)` method of the
geometry object (`engine.js`), their numbers through the single `solve`-like kinematic functions (`kin.js`), and their
state to the tests through `window.LIVE` (`live.js`) and `window.V8` (`film.js`). **NOT FOUND — using fallback:** the skill
has no named-parts convention. Here each subsystem is a three.js `Group` whose `name === id` (`machine.js`,
`G[s.id] = g; g.userData.id = s.id`), the presentation transform lives on that group, and kinematic children are kept in
`machine.dyn`. The numbers come from `kin.js` `solve(state)`, a pure function.

## b) Kit runtime API

- **Config and entry.** `sims/kit/runtime.js`: `export const BASE = {duration: 30, fps: 30, …}`; `export async function runSim(defaults, setup)`
  (line 65). The `setup` returns `{render(t), resize(), warm?}`; line 97: `if (!capture && sim.warm) await sim.warm();`.
- **Capture contract.** Line 119: `window.SIM = {cfg, duration, fps, ready: true, render: (t) => {…}}`. Capture mode is
  `window.__CAPTURE` or `?capture` (line 68). `render(t)` is pure: "no `Math.random` … no `Date`" (`SKILL.md`, "render(t) contract").
- **Live keys in runSim.** `kit/runtime.js` lines 140–155: space pause, `h` hide HUD, `f` fullscreen, `r` restart, arrows seek 2 s,
  digits jump to a stage. The live pages do not use `runSim` (`v8-shared/live.js` builds its own `#app` and stage).
- **Camera rig.** NOT FOUND in the kit. Reference: `v8-shared/stage.js` sets `camera.position` from `(tx, ty, tz, az, el, d)` and
  `camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h)`; the kit's `stage3d.js` shifts the
  projection centre to the middle of the HUD viewport. Used here: `stage.js` `frame(cam)` with `{target, az, el, d}`.
- **Lighting and materials.** `v8-shared/stage.js`: `THREE.NeutralToneMapping`, `VSMShadowMap`, a `DirectionalLight` with a 4096
  shadow map, a `HemisphereLight`, and an environment from `PMREMGenerator.fromScene` of a studio of soft boxes. Materials:
  `v8-shared/engine.js`: `MeshPhysicalMaterial({color: '#141518', roughness: 0.3, metalness: 0.2, clearcoat: 0.7, clearcoatRoughness: 0.18})`
  for black parts, `MeshStandardMaterial({metalness: 1})` for steel.
- **Shader warm-up.** `sims/kit/warm.js` `warmComposer(renderer, composer, scene, camera, jobs)`; `live.js` awaits it before the first
  frame (`v8-shared/live.js:368`).
- **Update loop and time base.** Live: `requestAnimationFrame` with `dt = Math.min(0.1, …)` (`v8-shared/live.js:276`). Film: a pure
  function of `t`, with the crank angle read from a table computed at `DT = 1/240` (`v8-shared/film.js:36–44`). **This project's
  live page uses a fixed step of 1/120 s** (the brief's determinism rule; `live.js` `STEP`), so the same inputs give the same motion.

## c) How geometry is authored

- **Extrusions with bevels:** `v8-shared/engine.js:18–38` `gearGeo()` builds gears with `ExtrudeGeometry` and `bevelEnabled: true`.
- **Tubes along curves:** `v8-shared/engine.js:65–72` `helixGeo()` uses `TubeGeometry(new CatmullRomCurve3(pts), seg, wire, 8, false)`.
- **Lathes:** `sims/cessna-shared/stage.js:47` `const lathe = (prof, seg = 48) => new THREE.LatheGeometry(…)`.
- **Instancing:** `sims/strandbeest-shared/beast.js` uses `THREE.InstancedMesh` for the repeated tubes, caps and feet.
- **Part counts and draw calls.** NOT FOUND in the skill as a rule. **Fallback used:** static parts are merged per owner and material
  with `three/addons/utils/BufferGeometryUtils.js` `mergeGeometries` (`machine.js` `batcher()`), so the machine is a few dozen draw
  calls. Moving parts are separate meshes, placed each frame from `solve()`.

## d) Kinematics pattern

- **Master parameter.** One angle per machine. `v8-shared/film.js:45–49` `thetaAt(t)` reads the crank angle from a table built
  from the speed script. Here the master is the balance wheel's angle `θ` (degrees, unwrapped), advanced by `script.js` `advance()`.
- **Closed form.** `v8-shared/kin.js` `piston(i, th)`: `s = pb + Math.sqrt(E.rod * E.rod - pp * pp)`, the exact slider-crank.
- **Circle intersection.** `sims/strandbeest-shared/jansen.js:2`: "turn the crank and every joint follows by circle intersection,
  no IK, no springs." This project uses the same method for the treadle four-bar (`kin.js` `fourBar`).
- **Rack and pinion.** `sims/cessna-shared/gear.js` (stroke → angle).
- **Here.** `kin.js` `solve(state)` is pure and returns every pose and every panel number. Tested: determinism, the belt ratio
  (2.31 : 1 = 0.30 m / 0.13 m), the 30 mm needle stroke, the treadle's 24.5° swing, and that the feed dog moves only while the needle
  is out of the cloth (`tests/exhibit.spec.mjs`).

## e) Panels: the real numbers around the machine

From `v8-shared/console.js`:

- Fixed layout `1600 x 900` CSS px; the stage scales it to the window (`live.js` `fit()`).
- Panel: `.pn{position:absolute;background:${C.panel};border:1px solid ${C.line}}` with `C.panel = 'rgba(248,248,249,.94)'`.
- Labels: `.cp{font-size:9.6px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase}`.
- Numbers and formulas: `JetBrains Mono` (`s = r·cos φ + √(L² − r² sin²φ)`); text: `Inter`. Both are inlined by `build.mjs`.
- Units are written after each value (`RPM`, `BAR`, `°`, `mm`). Update rate: every frame (`frameConsole` in `live.js`).
- Colours: one accent (`#d6182b`) for the thing that is working now; ink `#16181b`; muted `#8b8f95`.

## f) "Open the part": isolate, ghost, dolly, return

The reference's pattern is `isolate`:

- `v8-shared/live.js`: `ov.isolate = view === 'cyl' ? 1 : 0` (`setView`), and `solo` when "the camera is close" (`since > 1.25`).
- Ghosting: `v8-shared/engine.js:405` `const GHOST = new Map(…)`; ghosted meshes swap their material (`ghosted`, line 414).
- Camera easing: `v8-shared/live.js:338` `const k = 1 - Math.exp(-dt / (AP.on ? 0.18 : 0.45))`, i.e. exponential approach.
- Timing numbers from `SKILL.md` "Taste, with numbers": entrances `cubic-bezier(0.16, 1, 0.3, 1)`, exits
  `cubic-bezier(0.6, 0, 0.9, 0.35)` at half the entrance's length, state to state `cubic-bezier(0.65, 0, 0.35, 1)`.

**Here.** `presenter.js`: `OPEN_S = 1.1` s (an ease-out, `1 − (1 − x)³`), `CLOSE_S = 0.8` s (an ease-in, `x^2.2`). Opening B while A
is open queues "close A, then open B" in the same timeline (`build()`), so the two never overlap. The rest of the machine
ghosts (`machine.js` `applyGhost`, opacity `1 − 0.88·p`). The camera moves from the overview to the part's view by the same
progress (`live.js` `cameraFor`). The part keeps animating: it is posed from the same `solve()` every frame.

## g) Idle tour

- `v8-shared/live.js:14` `const IDLE = 25;` (seconds). Any input hands control over: `pointerdown` on the window (line 141),
  wheel and keys call `takeOver()` (lines 135–143, 223–240).
- The tour chip: `AUTO TOUR · CLICK TO TAKE OVER` / `▶ RESUME TOUR` (line 358).
- The tour plays the same script as the film (`v8-shared/film.js` `SCRIPT`), looped.

**Here.** `live.js` starts the tour after `idle` seconds of quiet (default 25; `?idle=N` overrides it for the tests). The script is
`script.js` `EVENTS`, shared with the film. Input takes over at once: the live presenter takes the tour's current state as its
starting point, so nothing jumps.

## h) Film

- Timeline: `v8-shared/film.js:11–21` `SCRIPT = [{t, cam}, {t, track}, {t, rpm: [a, b, dur]}, …]`; `DURATION = 26`.
- `render(t)` is a pure function of time (`film.js:221`).
- Captions: **NOT FOUND — using fallback.** The reference films have no captions. Here, captions follow the skill's timing rule,
  "1 s for a short phrase plus 0.25 s per word beyond three" (`SKILL.md`, "Review loop", checklist), in a lower-third card drawn
  by `console.js`.
- Capture: `node sims/capture.mjs <name> --size 1600x900 --dpr 1.2 --out …` (`capture.mjs` header lines 6–14). `--stills beats`
  reads every number in `<name>-film/timeline.json` (`capture.mjs` lines 109–122). `--still T` makes one PNG.
- Output paths: `teardown-out/` by default (`paths.mjs` `OUT`); this project writes the final files to `docs/assets/`.
- Review sheets: `sheet.mjs --video f.mp4 --timeline timeline.json` (`sheet.mjs` header).

## i) Sound

- `sfx/` synthesises every sound in pure Python at 48 kHz: `sfx/synth.py` (`click`, `pop`, `chime`, `pad`, `epiano`, …) and
  `sfx/score_kit.py` (`bed`, `thud`, `motor`, `airy`, `hiss`, `rattle`, `spans`, `rising`).
- A cue sheet is a `.py` file with `score(mix, tl)`; `run_sfx.py <cues.py>` renders it (`sfx/__main__.py:33–56`). `TARGET_LUFS`
  defaults to −14 (`__main__.py:55`); `mix.master` ceiling −2 dBFS (`sfx/mix.py:53`).
- Times come from the timeline JSON, never typed numbers (`SKILL.md`, "Sound").
- Example: `sims/v8-shared/score.py` (a bed, a thud per power stroke, a click per button).

**Here.** `sims/singer-treadle-shared/score.py` reads `sims/singer-treadle-film/timeline.json`: a treadle clack per treadle
cycle, a belt hum that rises with speed, a needle tick per stitch, a shuttle hiss, and a soft chime when a part opens.

## j) Build

- `sims/build.mjs` header (lines 2–9): `node sims/build.mjs <name>` bundles `sims/<name>/main.js` into `teardown-out/dist/<name>.html`.
- Inlined: three.js (esbuild, `format: 'esm'`, minified), JetBrains Mono 400/600/700 and Inter variable as base64 woff2
  (`build.mjs` lines 27–37), and `sims/kit/style.css`.
- Offline: no CDN, no `<link>`, no `<script src>`. `tests/exhibit.spec.mjs` asserts zero non-`file:` requests.
- Size: `build.mjs` prints the size (about 990 KB for the live page). The skill's rule is "keep the page under 1 MB" (`SKILL.md`,
  "Live page rules"). The page is 0.99 MB, so it is within the rule.

## k) The review loop (SKILL.md)

1. `--stills beats`: one tile per timeline beat, 0.3 s after it, each labelled `t=`.
2. Read every tile against the checklist: the mechanism (parts that should touch touch, nothing passes through), composition (one
   focal point, nothing within 60 px of an edge), type (nothing clipped), 3D (no blown highlights, roughness ≥ 0.45 on big surfaces),
   timing (each state holds long enough to read).
3. Zoom with `--stills every:0.2 --from A --to B` or `--still T`.
4. Fix, rebuild, return to 1. Stop when a full pass finds nothing.
5. Final: `sheet.mjs` on the encoded video.

The iteration record is in `docs/review/` (one sheet and one note per round).

## l) Naming, layout and mandatory rules

- Folders: `<name>-shared/` (the machine), `<name>-live/` (the page), `<name>-film/` (the timeline). Here: `singer-treadle-shared`,
  `singer-treadle-live`, `singer-treadle-film`.
- Module names follow the skill's table: `kin.js`, `machine.js` (geometry, in place of `engine.js`), `stage.js`, `console.js`,
  `film.js`, `live.js`, `score.py`; plus `subsystems.js` (the registry), `presenter.js` (the open/close timeline), `script.js`
  (the shared timeline), `materials.js`.
- Mandatory rules quoted in `SKILL.md`: "Start from a reference, never from imagination", "Real numbers, one source", "One input drives
  everything", "The part doing the work opens up", "Light studio, one accent", "Pick the camera for the mechanism", "Fix collisions
  with a number". This exhibit follows each (see `docs/PLAN.md` §1.1–1.2 for the dimensions and the collision checks).

---

## Deviations

1. **Ids.** The brief's subsystem ids are used exactly. `drive_wheel` is the **balance (hand) wheel**, as the brief's table says
   ("balance/hand wheel, hub, stop-motion knob"). The brief's chain also has a big band wheel under the table; it is not in the table,
   so it is placed in `belt_drive` ("leather belt loop, guide, belt hook") and documented there.
2. **Connecting rod.** The link from the arm shaft's crank pin to the needle bar is in `crankshaft` (the brief lists the crank and the
   shaft there). It is the link the brief's needle-bar description implies.
3. **The kit is vendored.** The skill lives in `~/.claude/skills`, which a clone does not have. Copies have the same content (checked with `diff -r`).
4. **Batching.** Merging static parts per material is not a skill rule (see c).
5. **Captions.** Added (see h); the skill's films have none.
6. **Fixed-step live simulation.** The skill's live pages integrate real `dt`; the brief requires determinism, so the live page steps
   at 1/120 s (see b).
7. **The tour and the film share one script** (`script.js`), so the tour and the 88 s film cannot disagree.
8. **Procedural textures.** Oak grain, belt leather and the gold decal are drawn on canvases at load (`materials.js`), so nothing
   is fetched. No external images or fonts are loaded at run time.
9. **Historical claims.** Each period fact in `subsystems.js` is checked against a source or written as a plain statement of how
   the part works. The decal-era attribution ("Sphinx" and "Red Eye" by date) could not be verified and is **not** stated; see
   `docs/research/source-notes.md`.
