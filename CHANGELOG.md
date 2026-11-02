# Changelog

All notable changes. Dates are UTC.

## 1.0.0 (2026-11-01)

- **Exhibit**: 16 subsystems as 16 static bodies built from 55 generated `.vox` models (1 cm voxels,
  ~96 k voxels), a brass lectern console with 16 numbered buttons plus RESET and RUN, a plinth, and a
  display dais with two warm lamps.
- **Choreography**: per-subsystem multi-leg exit paths, a rigid group slide, a Bezier presentation
  with slerped display poses and ±12° sway. Frame mode for the head and cabinet (other parts make
  way first). Exact time-reversed closing with snap-to-home.
- **Articulation on display**: drawers, drop-front, feed-mechanism spread, shuttle race.
- **RUN**: 6 s demonstration driven by one input (band-wheel angle). Treadle ±12° by circle
  intersection, rigid pitman, 2.5:1 belt ratio, needle bar, shuttle, feed dog. Ends exactly at home.
- **UI**: title line, hover prompt, info panel with function, connections and a period fact for every subsystem.
- **Sounds**: procedurally synthesised brass click and mechanical slide (`tools/make_sounds.py`).
- **Verification**: `tools/run_tests.py`, 30 checks running the real Lua under Lua 5.1, including
  voxel-exact path collision checks; `tools/crosscheck.py` for XML↔Lua tags.
- **Web edition and site**: three.js port of the exhibit on GitHub Pages, with an interactive
  subsystem gallery, architecture and state-machine diagrams, and 26 auto-captured screenshots.
- **Docs**: `CONVENTIONS.md` (reference-repo inspection, fallbacks, deviations), `PLAN.md`, modding guide.

## 0.1.0 (2026-11-01)

- Repository created; reference repository inspected (it is the web "teardown" exhibit kit, not a
  Teardown game mod), conventions documented.
