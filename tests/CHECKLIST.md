# Acceptance checklist

## A. Automated (run on every change: `python tools/build.py`)

| # | Check | Tool | Status (1.0.0) |
|---|---|---|---|
| A1 | `prefab.xml` well-formed; each `sys=<id>` on exactly one body; each has exactly one `btn=<id>`; `btn=reset`, `btn=run` exist | `crosscheck.py`, T1 | ✅ |
| A2 | Lua `SUBSYSTEMS` ids == XML ids; every `connects` entry is a real id; every vox file exists | `crosscheck.py`, T1 | ✅ |
| A3 | No global leaks: loading `exhibit.lua` adds only `init`, `tick`, `draw` | T2 | ✅ |
| A4 | `init()` resolves 16 bodies, 18 buttons, all articulated shapes; missing handles are skipped (`~= 0` guards) | T3 | ✅ |
| A5 | Every subsystem: open → shown → close returns all bodies and shapes to within 1e-4 of home | T4 | ✅ (error 0) |
| A6 | OPENING and CLOSING each take exactly `OPEN_TIME` (2.6 s) ± 1 frame | T4 | ✅ |
| A7 | Press B while A is shown: A closes completely before B starts opening | T5 | ✅ |
| A8 | RESET from IDLE, OPENING, SHOWN, CLOSING and RUN ends in IDLE at home; RESET mid-opening reverses without a jump | T6 | ✅ |
| A9 | RUN lasts 6 s, treadle swings ±12°, pitman length constant, ends exactly at home | T7 | ✅ (max 12.4°) |
| A10 | Determinism: identical input → bit-identical transforms | T8 | ✅ |
| A11 | Present phase: the moving subsystem's box never intersects a shifted body's box (≥ 60 samples) and has zero voxel contacts | T9 | ✅ |
| A12 | Idle cost: 1 raycast/tick, 0 transform writes, 0 `Find*` calls | T10 | ✅ |
| A13 | Budgets: ≤ 20 bodies, ≤ 180 shapes, ≤ 250 k voxels, ≤ 30 shapes/body | `generate.py` | ✅ 18 / 55 / 95 871 / 19 |

## B. Manual, in Teardown (needs the game)

Spawn the exhibit in a flat sandbox level and stand in front of the console.

- [ ] B1 The exhibit appears assembled: head on the table, belt from the band wheel to the balance
      wheel through the table, treadle between the frames, drawers on the left, console to the right.
- [ ] B2 Parts are where the web edition shows them. If a part is offset by half its size, the
      vox-pivot assumption (CONVENTIONS §12) differs: report it.
- [ ] B3 Looking at a button within 2.5 m outlines it and shows `[E] Inspect: <name>`; beyond 2.5 m nothing.
- [ ] B4 `E` on each of the 16 buttons: the part withdraws, the machine slides left, the part arrives at
      the display point and sways; the panel fades in with the right text.
- [ ] B5 The active button glows; only that button glows.
- [ ] B6 `E` on the same button returns everything home; nothing is left a few millimetres out of place.
- [ ] B7 With a part shown, `E` on another button: first goes home, then the second comes out.
- [ ] B8 RESET mid-opening reverses smoothly; RESET while shown closes.
- [ ] B9 RUN from rest: treadle rocks, pitman follows, wheels turn (balance wheel 2.5× faster), needle
      bar goes up and down, shuttle swings; after 6 s everything is exactly home.
- [ ] B10 Shoot, blast, and set fire next to the exhibit: no voxel is destroyed, nothing burns or falls.
- [ ] B11 Spawn two exhibits side by side: each console controls only its own machine.
- [ ] B12 Frame rate with the exhibit idle is unchanged; during motion the drop is negligible.
- [ ] B13 Click and slide sounds play once per press / transition and never during sway or RUN.
