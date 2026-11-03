# Contributing

Thanks for helping improve the exhibit.

## Ground rules

- **Read [docs/CONVENTIONS.md](docs/CONVENTIONS.md) first.** Structural, naming, kinematic, panel, interaction, film and build
  decisions follow it. Deviations go in its *Deviations* section, with the reason.
- **Real numbers, one source.** Every dimension lives in `DIM` in `sims/singer-treadle-shared/kin.js`. Panels, poses and tests
  read the same values. Change a dimension there, not in the geometry.
- **Pure motion.** Poses are pure functions of the solver's output. No `Math.random`, no `Date`, no wall clock in `kin.js`,
  `presenter.js`, `script.js` or `film.js`. The live page steps at a fixed 1/120 s.
- **The ids are fixed.** The sixteen subsystem ids (`subsystems.js`) are used by buttons, keys, the tour, the film, the tests and
  the crosscheck. Add a seventeenth as described in the README.
- **Period facts must be sourced.** Cite a source in the pull request for any new historical claim, or write it as a
  description of how the part works. Put the source in `docs/research/source-notes.md`.
- **Fix collisions with a number.** If two parts touch in a pose, change a dimension or the pivot, not the camera.

## Workflow

```bash
npm install && npx playwright install chromium
npm run build        # the live page must build (≈1 MB, offline)
npm test             # build, crosscheck and the Playwright suite must pass
npm run film         # only when the look or the script changed; re-check docs/review/
```

Commit small, with meaningful messages. Describe in the pull request what you verified (the suite, and the screenshots you read).

## Code style

- ES modules, no framework, no build step beyond `sims/build.mjs`.
- Three.js: build static geometry through the batcher in `machine.js`; keep moving parts as separate meshes posed in `update()`.
- Comments say *why*, not what the code does. Keep the console's strings in the console, the texts in `subsystems.js`.
