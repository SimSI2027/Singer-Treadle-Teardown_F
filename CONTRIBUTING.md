# Contributing

Thanks for helping improve the exhibit.

## Ground rules

- **Geometry lives only in `tools/generate.py`.** Never edit `prefab.xml`, `vox/*.vox`,
  `docs/assets/geometry.*` or the `GENERATED GEOMETRY` block of `exhibit.lua` by hand. Change the
  generator and re-run it.
- **Behaviour lives in `exhibit.lua`**: timings in `CONFIG`, per-subsystem data in `SUBSYSTEMS`.
  Keep poses pure functions of time: no `math.random`, no wall clock, no physics calls
  (`SetBodyVelocity`, `Explosion`, `MakeHole`, `Shoot`, `Paint` are never used).
- **The web edition is a port**, not a fork: if you change pose logic in `exhibit.lua`, make the
  same change in `docs/viewer.js`.
- **Fix collisions with a number.** If T9 reports a contact, change an `exit` leg, never hide it.
- Exhibit texts must be historically accurate; cite a source in the PR for any new fact.

## Workflow

```bash
pip install lupa
python tools/build.py          # must end with "build OK" and 30 / 30 checks
cd tools/screens && npm install && node capture.mjs   # if visuals changed
```

Use small commits with meaningful messages, and describe in the PR what you verified (offline checks,
and in-game items from `tests/CHECKLIST.md` if you have Teardown).

## Code style

- Lua: tabs, `local` everything (the tests fail on any new global besides `init`, `tick`, `draw`),
  constants in `CONFIG`.
- Python: standard library only, except `lupa` in the test runner.
- JavaScript: ES modules, no build step.
