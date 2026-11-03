# PLAN: Singer Treadle Exhibit

Phase 1 of the brief. Everything here follows `docs/CONVENTIONS.md`; deviations are listed there.
All numbers below come from the generated data (`tools/generate.py`, `docs/assets/geometry.json`),
not from estimates.

## 1. Subsystems

Machine frame: x = visitor's right, y = up, z = toward the visitor, origin on the plinth top under
the machine. Exit legs are in metres in the exhibit frame; each leg is eased on its own, so the part
comes to rest at every corner. Display poses are Euler degrees `{x, y, z}` (applied X, then Z, then Y).

| # | id (tag value) | body | shapes | voxels | size (cm) | exit path (m) | display pose | mode |
|---|---|---|---|---|---|---|---|---|
| 1 | `needle_assembly` | `sys_needle_assembly` | 1 | 88 | 9×30×6 | (0, 0, 0.27) | 0, 35, 0 | part |
| 2 | `presser_foot` | `sys_presser_foot` | 1 | 96 | 3×32×13 | (0, 0.01, −0.18) | 0, −30, 0 | part |
| 3 | `bobbin` | `sys_bobbin` | 1 | 70 | 9×5×6 | (0, 0, 0.22) | 15, 40, 0 | part |
| 4 | `shuttle` | `sys_shuttle` | 4 | 418 | 8×29×27 | (0, 0, 0.42) | −35, 20, 0 | part |
| 5 | `drive_wheel` | `sys_drive_wheel` | 1 | 310 | 9×14×14 | (0.10, 0, 0) | 0, 90, 0 | part |
| 6 | `belt_drive` | `sys_belt_drive` | 3 | 1,137 | 17×78×31 | (0, 0, 0.47) | 0, 90, 0 | part |
| 7 | `treadle` | `sys_treadle` | 1 | 2,013 | 74×5×31 | (0, 0, 0.40) | 20, 0, 0 | part |
| 8 | `pitman_rod` | `sys_pitman` | 1 | 207 | 3×34×14 | (−0.03, 0, 0) then (0, 0, 0.40) | 35, 90, 0 | part |
| 9 | `crankshaft` | `sys_crankshaft` | 1 | 193 | 34×4×4 | (0, 0, 0.29) | 10, −15, 0 | part |
| 10 | `gear_train` | `sys_gear_train` | 5 | 425 | 32×11×13 | (0, −0.12, 0) then (0, 0, 0.40) | −20, 25, 0 | part |
| 11 | `tension_regulator` | `sys_tension_regulator` | 1 | 76 | 8×7×6 | (0, 0, 0.28) | 0, 90, 0 | part |
| 12 | `spool_pin` | `sys_spool_pin` | 1 | 120 | 6×7×6 | (0, 0.10, 0) | 0, 20, 0 | part |
| 13 | `thread_guide_path` | `sys_thread_guide_path` | 2 | 136 | 27×32×10 | (0, 0.04, 0.32) | −8, 0, 0 | part |
| 14 | `machine_head` | `sys_machine_head` | 1 | 4,613 | 41×33×18 | (0, 0.05, 0) | 0, 30, 0 | frame |
| 15 | `cabinet` | `sys_cabinet` | 5 | 16,940 | 110×76×44 | (0, 0, −0.35) | 0, 0, 0 | frame |
| 16 | `drawers` | `sys_drawers` | 5 | 7,992 | 58×27×43 | (0, 0, 0.45) | 0, 20, 0 | part |

The pitman's body is named `sys_pitman` and tagged `sys=pitman_rod`; every lookup goes through the
tag, so body names are free.

### Interpretation notes

The brief's table puts the "balance (hand) wheel, hub, stop-motion knob" in `drive_wheel`, while its
dimensions call the Ø 0.30 m wheel the drive wheel and say the pitman connects "to the crank on the
drive wheel". Resolved as follows, matching how a real Singer stand is built:

* **`drive_wheel`** is the balance wheel on the head (Ø 13.6 cm, stop-motion knob), exactly as the table lists.
* **`belt_drive`** owns the Ø 30.8 cm **band wheel** in the stand together with the belt, belt hook and
  guide. The band wheel is the driving pulley of the belt drive, and its crank pin is where the pitman attaches.
* **`crankshaft`** is the arm shaft in the head with its crank disc, counterweight, eccentric and bushings.
* **`gear_train`** is the feed mechanism under the bed. The card text says plainly that vibrating-shuttle
  Singers drove their lower shafts with a crank and rod, and that the bevel pair shown is the later rotary practice.

### Articulation while on display (shape-level, same clock)

| subsystem | shapes (tag `art=`) | motion |
|---|---|---|
| drawers | `drawer_1..3`, `dropfront` | slide out 21/17/13 cm (≈60 %), drop-front swings down 80° |
| gear_train | `feed_dog`, `rock_shaft`, `cam_shaft`, `bevel_a`, `bevel_b` | spread 3–5 cm apart |
| shuttle | `slide`, `boat` | slide plate pulled 5 cm, shuttle swung 22° out of the race |
| belt_drive | `band_wheel` | turned 45° so the crank pin is visible |

## 2. Dimensions (generated)

| item | value |
|---|---|
| table top | 90 × 44 cm, top surface 76 cm above the plinth, 3 cm oak, drop leaf +20 cm on the left |
| side frames | cast iron, 73 cm tall, 42 cm deep at the feet, diamond lattice, cast `SINGER` band |
| head | bed 41 × 18 cm; arm 31 cm long, 10 cm tall; arm-shaft axis 1.00 m above the plinth |
| treadle | 40 × 30 cm lattice plate on a 74 cm pivot rod, pivot 9 cm above the plinth |
| band wheel | Ø 30.8 cm, belt groove radius 14.4 cm; crank pin radius 3.1 cm |
| balance wheel | Ø 13.6 cm, belt groove radius 5.76 cm, so the belt ratio is exactly **2.5** |
| pitman | 32.9 cm between pivots |
| voxel | 1 cm (`scale="0.1"`) |

## 3. Exhibit layout (exhibit frame, metres)

| anchor | position | role |
|---|---|---|
| `anchor=machine` | (0, 0.08, 0) | the machine on its 8 cm plinth |
| `anchor=shift` | (−0.90, 0.08, 0) | where the machine group slides to (pure left) |
| `anchor=display` | (0, 1.10, 1.30) | where a subsystem comes to rest, over a brass-ringed dais |
| console | x 0.56–1.15, z 1.33–1.71, plate top 0.94–1.00 | stepped brass lectern, 4×4 + RESET + RUN |
| lamps | (0, 2.2, 1.3) and (0.85, 1.7, 1.45) | two warm sphere lights |

The visitor stands at about z = 2.0–2.3, with the console at their right hand and the display point in front.

## 4. State machine and timing

```
IDLE --press id--> OPENING --t = 2.6 s--> SHOWN --press same / RESET--> CLOSING --t = 0--> IDLE
                       \--RESET (reverses from current t)--------------^        |
SHOWN --press other id--> CLOSING (queue = id) ---------------------------------+--> OPENING(id)
IDLE --RUN--> RUN --6 s--> IDLE (snapped home)
```

`CONFIG` in `exhibit.lua` holds every constant:

| constant | value | meaning |
|---|---|---|
| `LIFT_START..LIFT_END` | 0.00–0.60 s | part withdraws along its exit path (frame mode: every *other* part makes way) |
| `SHIFT_START..SHIFT_END` | 0.45–1.40 s | rigid group slides to the shift point |
| `FRAME_LIFT_*` | 0.45–0.80 s | frame subsystem lifts clear (cabinet: 0.62–0.95 s via its `lift` override) |
| `FRAME_SHIFT_*` | 0.70–1.60 s | group slide in frame mode |
| `PRESENT_START..PRESENT_END` | 1.00–2.60 s | cubic Bezier to the display point + slerp to the display pose |
| `ARTICULATE_*` | 1.70–2.60 s | drawers open, gears spread |
| `SWAY_DEG`, `SWAY_RATE` | 12°, 0.6 rad/s | `yaw = 12° · sin(0.6 t)` while SHOWN |
| `RUN_TIME`, `RUN_RAMP`, `RUN_TURNS` | 6 s, 1.2 s, 4 | trapezoidal speed; 4 band-wheel turns = 10 stitches |
| `RAY_DIST` | 2.5 m | button reach |

Closing is the time-reverse of opening; the sway yaw captured at the moment of closing is blended out
with the present progress, so there is no jump. At t = 0 every body and articulated shape is
snapped to its stored home transform.

## 5. Performance budget (enforced by the generator)

| budget | limit | actual |
|---|---|---|
| bodies | ≤ 20 | 18 (16 subsystems + console + plinth) |
| shapes | ≤ 180 | 55 |
| voxels | ≤ 250 000 | 95 871 |
| shapes per body | ≤ 30 | 19 (console: 18 buttons + plate) |
| raycasts per tick | 1 | 1 (measured, T10) |
| `Find*` after `init()` | 0 | 0 (measured, T10) |
| transform writes when idle | 0 | 0 (measured, T10) |
| lights | ≤ 2 | 2 |
| dynamic bodies, joints, ropes, particles | 0 | 0 |

The plinth and dais are hollow shells and the castings are 1 cm walls. That keeps the solid-looking
exhibit under 100 k voxels.

## 6. Collision-free separation, verified

`tools/run_tests.py` (T9) replays every opening frame by frame and tests every voxel of the moving
part against every other body (and the console and dais) at its true position. In frame mode it also
tests the parts making way against each other. Results in the current build:

* **Present phase: zero contacts, and no bounding-box overlaps,** for all 16 subsystems (60+ samples each).
* Withdrawal phase: contacts remain only where parts are physically threaded through each other in the
  real machine: the thread through the needle eye and the take-up lever eye (≤ 7 voxels), the belt in
  the balance-wheel groove and the table holes (≤ 28), pins inside the pitman sockets (≤ 4), and
  1–2 voxels where the feed bar passes the shuttle carrier. A rigid body cannot leave such a loop without crossing it.
