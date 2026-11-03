# PLAN: the Singer treadle teardown exhibit

Scope: one antique Singer treadle sewing machine (c. 1880–1915: cast-iron head, vibrating shuttle, balance wheel, leather
belt to a big band wheel, cast-iron treadle stand, oak cabinet with drawers). Built on the teardown skill: one offline HTML page
(`dist/singer-treadle.html`), a recorded film, and a test suite. The conventions this follows are in [CONVENTIONS.md](CONVENTIONS.md).

## 1.1 Dimensions (real-world scale, metres, Y up)

The operator sits on +z and faces −z. Every number is in `sims/singer-treadle-shared/kin.js` (`DIM`); the tests read the same object.

| Part | Value (m) | Where (x, y, z) |
|---|---|---|
| Cabinet top | 0.90 × 0.46, top at 0.76 | centre (0, 0.7425, 0) |
| Cabinet body | 0.77 × 0.505 × 0.40, bottom at 0.22 | (0, 0.4725, 0) |
| Cast-iron standards | 0.024 thick, at x = ±0.41, floor to 0.725 | lattice of 5 × 5 bars |
| Head: bed | 0.47 × 0.05 × 0.14 | x −0.14…0.33, y 0.76…0.81 |
| Head: arm | 0.50 × 0.12 × 0.10 | arm top 1.06, underside 0.94 (throat 0.13) |
| Head: pillar | 0.10 wide, 0.81 → 1.06 | x 0.33 |
| Balance wheel (drive_wheel) | Ø 0.13 | centre (0.50, 1.00, −0.02) |
| Big band wheel (belt_drive) | Ø 0.30 | centre (0.50, 0.34, −0.14) |
| Needle stroke | 30 mm | tip 0.830 (top) to 0.800 (bottom), plate at 0.810 |
| Treadle | lever 0.48 long (rear 0.26, foot 0.22), plate 0.30 × 0.36 | pivot (0.44, 0.05, −0.02) |
| Pitman | 0.32 m | joints at x 0.455 and 0.475 |
| Drop-front drawer | 0.24 × 0.42 | hinged at (0, 0.25, 0.20) |

## 1.2 The kinematic chain and its numbers

Chain: treadle rocks ±12° (24.5° measured) → pitman (0.32 m) → crank pin on the band-wheel hub (radius 0.05 m) → band wheel
(Ø 0.30) → leather belt → balance wheel (Ø 0.13, one stitch per turn) → arm shaft → crank (radius 0.015) + link (0.085) → needle bar
(30 mm stroke). The take-up lever, the vibrating shuttle and the feed dog are driven from the same shaft.

Ratio: band wheel : balance wheel = 0.30 : 0.13 = **2.31 : 1**. Belt speed = 4.08 m/s at 600 stitches a minute.

Master parameter: `θ`, the balance wheel's angle. One stitch = 360°. Stitches a minute = balance-wheel rpm.

**Stitch-cycle timing (θ in degrees; measured from `cycleCurves`):**

| θ | Needle tip (mm above plate) | Take-up lever | Shuttle β | Feed dog |
|---|---|---|---|---|
| 0 | +20 (top) | −30 lead… peak at θ = 330 | 30·sin(−180) = 0 | rising, engaged |
| 30 | ~+13 | … | … | engaged to ±29° |
| 90 | ~+5 (leaving cloth) | falling | β = −30 | dog down |
| 150 | ~−6 (in cloth) | trough | β = −15 | down |
| 180 | −10 (bottom) | falling | **0: hook passes the needle** | down, returning |
| 270 | ~+3 (rising) | rising | +30 | down |
| 330 | ~+15 | peak (+35 · cos 0 at θ = −30) | … | rising |

The needle is out of the cloth (tip above the plate) for about θ ∈ (−100°, +100°). The feed dog's teeth rise above the plate only
for |θ| < 29°, inside that window (tested: zero violations).

## 1.3 Panels (live, from one solve per frame)

Chain (left, top): treadle angle (°), band-wheel rpm, balance-wheel rpm, belt ratio, belt speed (m/s).
Stitch (left, lower): needle-bar height (mm above the plate), take-up lever (°), shuttle phase (°), feed-dog phase (°), stitch
length (mm), stitch count, thread tension (/10). Headline: stitches a minute and the stitch count.
Top centre: the stitch-cycle strip (needle, take-up, shuttle, feed) with a cursor at θ.
Right: the part card (number, name, hint, function, connected chips, period fact), or the index of the sixteen parts.

## 1.4 Subsystem table

Ids are fixed (`subsystems.js`, `IDS`). Button labels and keys: `1–9`, `0`, `Q W E T Y U` for 11–16.

| # | id | Name | Open-view hint | Connected to |
|---|---|---|---|---|
| 1 | needle_assembly | Needle Assembly | vertical, clamp visible | crankshaft, thread_guide_path, shuttle, presser_foot |
| 2 | presser_foot | Presser Foot | foot facing the visitor | needle_assembly, gear_train, machine_head |
| 3 | bobbin | Bobbin & Winder | winder angled | drive_wheel, shuttle, belt_drive |
| 4 | shuttle | Vibrating Shuttle | race opened toward the visitor | needle_assembly, bobbin, gear_train, crankshaft |
| 5 | drive_wheel | Balance Wheel | face-on, spinning | belt_drive, crankshaft, bobbin, needle_assembly |
| 6 | belt_drive | Belt Drive & Band Wheel | loop visible, moving | treadle, pitman_rod, drive_wheel, bobbin |
| 7 | treadle | Treadle | tilted 20°, rocking | pitman_rod, belt_drive, cabinet |
| 8 | pitman_rod | Pitman Rod | diagonal, following the crank | treadle, belt_drive |
| 9 | crankshaft | Arm Shaft & Crank | horizontal, exploded | drive_wheel, needle_assembly, shuttle, gear_train, tension_regulator |
| 10 | gear_train | Feed Mechanism | exploded so the cams show | presser_foot, needle_assembly, shuttle |
| 11 | tension_regulator | Tension Regulator | face-on, discs part axially | spool_pin, thread_guide_path, needle_assembly |
| 12 | spool_pin | Spool Pin | vertical | tension_regulator, thread_guide_path |
| 13 | thread_guide_path | Thread Path | flat map, animated flow | spool_pin, tension_regulator, needle_assembly |
| 14 | machine_head | Machine Head | 30° yaw, face plate swings open | needle_assembly, presser_foot, crankshaft, cabinet |
| 15 | cabinet | Cabinet & Stand | as-is, orbit | treadle, machine_head, drawers, pitman_rod |
| 16 | drawers | Drawers | drawers slid open 60 % | cabinet, presser_foot |

Each entry (`subsystems.js`) has: display name, pivot (the part's home point), the open-view preset (`cam`), callouts (label,
sub-label, anchor point), connected ids, a 2–3 sentence function text and a period fact. Facts are sourced in
[research/source-notes.md](research/source-notes.md).

## 1.5 Idle tour

Starts after 25 s of quiet (`?idle=N` overrides it). It plays the tour script (`script.js` `TOUR_EVENTS`), which visits all sixteen
parts and loops (about 112 s). Times are the beat starts, from the script (`lay()`):

| Tour time (s) | Beat |
|---|---|
| 0–8 | the overview; caption: a Singer treadle, one stitch per turn of the balance wheel |
| 8 | treadle (the wheel is pumped from 6 s, up to 240 stitches a minute) |
| 14.6 | pitman rod |
| 20.6 | belt drive and band wheel |
| 27.1 | balance wheel |
| 33.1 | arm shaft and crank |
| 39.1 | needle assembly |
| 45.6 | vibrating shuttle |
| 52.1 | feed mechanism |
| 58.6 | thread path |
| 65.1 | presser foot |
| 70.1 | bobbin and winder |
| 75.1 | tension regulator |
| 80.1 | spool pin |
| 85.1 | machine head |
| 90.6 | cabinet and stand |
| 96.1 | drawers |
| 101.6–111.6 | overview; caption: press a number to open a part |

Any pointer, key, wheel or drag ends the tour at once. The live presenter takes the tour's state as its starting point, so the
part on display does not jump.

## 1.7 Performance budget

| Item | Budget | Measured (this session) |
|---|---|---|
| Frame time, headless Chromium, ~10 s running | < 20 ms | passes the suite (`tests/exhibit.spec.mjs`); integrated-GPU laptop not tested |
| Meshes in the machine | (see draw calls) | 79 (static parts merged per owner and material, plus the moving parts) |
| Draw calls per frame | ≤ ~400 | estimate: 79 meshes in the colour pass, the same meshes in the shadow pass, and the occlusion pass, about 240 |
| Triangles in the machine | ≤ ~1.5 M | about 18,300 |
| Single HTML page | ≤ ~1 MB (the skill's link-crawler rule) | 0.99 MB (`dist/singer-treadle.html`) |
| Network requests at run time | 0 | asserted by `tests/exhibit.spec.mjs` |

## 1.8 Verification plan

`tests/exhibit.spec.mjs` (Playwright, Chromium) and `tests/CHECKLIST.md`:

- load the built file from `file://`: no console errors, no network requests, WebGL context created;
- exactly 16 subsystem keys with the fixed ids, plus RESET;
- each id: open → screenshot to `docs/screenshots/sub-<id>.png` → RESET → every group's transform within 1e-4 of home;
- open A, then B: A is closed before B opens (from the event log);
- idle: after the threshold the tour starts; input cancels it;
- numbers: band rpm / balance rpm ≈ 0.13/0.30 (±2 %), stitches/min = balance rpm, needle at bottom dead centre when the
  shuttle hook passes, the feed dog moves only while the needle is out of the cloth;
- determinism: `solve(state)` twice, deep-equal;
- performance: average frame time over ~10 s; the headless threshold is 20 ms;
- `tools/crosscheck.mjs`: each id in the registry has a button, a tour beat, info text and a screenshot.
