# Modding guide: install, controls, and adding a subsystem

## Install

Copy the repository folder into `Documents/Teardown/mods/` (the repository root is the mod root),
enable **Singer Treadle Exhibit** in the mod manager, then spawn it from the spawn menu:
**Exhibits → Singer Treadle Exhibit**. You can spawn several; each finds only its own parts, because
`prefab.xml` puts every body *inside* the `<script>` element and all finds use `global = false`.

## Controls

| | |
|---|---|
| look at a console button within 2.5 m | outline + `[E] Inspect: <name>` |
| `E` | open that subsystem / RUN / RESET |
| `E` on the open subsystem's button | close it |
| `E` on another button while one is shown | close the current one, then open the new one (one-slot queue) |
| RESET (red, R) | from OPENING it reverses smoothly from where it is; from SHOWN it closes |
| RUN (green, ▶) | 6 s demonstration, only from rest; queued if pressed while a part is shown |

Presses during OPENING, CLOSING and RUN are ignored by design (RESET excepted).

## How it fits together

* `tools/generate.py` is the only place geometry lives. It writes `vox/`, `prefab.xml`, the
  `GENERATED GEOMETRY` block of `exhibit.lua`, and the web data in `docs/assets/`.
* `exhibit.lua` holds everything behavioural: `CONFIG` (timings) and `SUBSYSTEMS` (paths, poses,
  text) at the top, then pure pose functions and the state machine.
* `tools/run_tests.py` runs the real script against `tools/stub_api.lua` and fails on any regression.

## Adding a 17th subsystem (under 10 lines)

Say you want to add the **face plate** as its own subsystem.

1. In `tools/generate.py`, add a builder and register the id (3 lines + geometry):

   ```python
   def build_face_plate():
       f = S("face_plate", "face_plate", 85)          # shape name, body name, priority
       box(f, -20, -19, 86, 106, -5, 5, "iron")        # ...your voxels, in machine-frame cm
   SUBSYSTEM_IDS.append("face_plate"); BODY_OF_ID["face_plate"] = "face_plate"
   ```

   and call `build_face_plate()` in `main()`. The console grows a 17th button automatically. Its
   grid position is `divmod(index, 4)`, so a fifth row appears; enlarge the plate's `Z1` by 9 cm.
2. In `exhibit.lua`, add one entry to `SUBSYSTEMS` (one table, about 6 lines):

   ```lua
   { id = "face_plate", name = "Face Plate", exit = {{-0.10, 0, 0}}, pose = {0, 90, 0},
     text = "...", connects = {"machine_head", "needle_assembly"}, fact = "..." },
   ```

3. Run `python tools/build.py`. The cross-check fails if the id is missing on either side. T9 reports
   any voxel contact along the new exit path: lengthen or redirect `exit` until the path is clear
   (reference-kit rule: *fix collisions with a number, never hide them*).

## Tuning

* All timings: `CONFIG` at the top of `exhibit.lua`. Keep `PRESENT_START ≥ LIFT_END` and
  `OPEN_TIME = PRESENT_END`; T4 checks the durations.
* A part's path: its `exit` legs (exhibit-frame metres). An exit must end where the part is clear of
  the machine's slide to the left: in front of z ≈ 0.25 m, above it, or behind it.
* Display: `pose` (Euler degrees), `offset` (from the display point), `out` / `approach` (Bezier
  control offsets), `art` (shape articulation).
* If Teardown on your machine resolves `.vox` pivots differently, see `docs/CONVENTIONS.md` §12: each
  shape is generated symmetric about its own position, so only the `pos` computed for each shape in
  `main()` of `tools/generate.py` would need changing.
