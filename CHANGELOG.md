# Changelog

All notable changes. Dates are UTC.

## Unreleased: rebuilt on the elvarofficial/teardown skill

The project was rebuilt as an interactive three.js simulator of an antique Singer treadle sewing machine. The earlier version
was a Teardown video-game mod; it was removed and its reusable research was archived (`docs/research/`). Git history keeps
every removed file (commit `1ff9b38` is the last commit that has them).

### Removed (Teardown-game mod artifacts)

| Files | Why removed |
|---|---|
| `exhibit.lua`, `prefab.xml`, `info.txt`, `spawn.txt` | Teardown game script, prefab, mod metadata and spawn entry. The game API they call has no place in a browser simulator. |
| `vox/` (55 `.vox` voxel models) | Voxel assets for the game's engine. The new machine is procedural three.js geometry. |
| `snd/` (2 `.ogg` cues) | Brass click and slide sounds for the game. Replaced by the skill's procedural score. |
| `tools/` (generator, Lua stub API, Lua test runner, XML↔Lua crosscheck, make_sounds, the web port's screenshot script) | Built for the game's file formats. Replaced by the skill's build and capture pipeline and this repo's `tools/`. Only ignored `node_modules` from the screenshot tool remained on disk and was deleted. |
| `tests/CHECKLIST.md` | An in-game acceptance checklist for the game. Replaced by `tests/CHECKLIST.md` for the browser exhibit. |
| `docs/app.js`, `docs/viewer.js`, `docs/index.html`, `docs/style.css`, `docs/README.md`, `docs/assets/` | The web port of the voxel exhibit (exhibit.json, geometry.bin/json, test-report.json, copied CHANGELOG/ROADMAP) and the modding guide. The Pages site is rebuilt from the skill's page. |

### Archived to `docs/research/` (reusable, kept for reference)

- `docs/research/mod-subsystem-notes.md`: the sixteen subsystem texts and facts from the mod's `SUBSYSTEMS` table. Re-verify before reuse.
- `docs/research/mod-PLAN.md`, `docs/research/mod-CONVENTIONS.md`: the mod's plan and conventions (written for the wrong premise).
- `docs/research/voxel-mod-screenshots/`: the 26 renders of the voxel models and `preview.jpg`. These show the old voxel machine, not the new one.

### Added

- The skill's kit, byte-identical to `~/.claude/skills/teardown`: `sims/kit/`, `sims/build.mjs`, `sims/capture.mjs`, `sims/beats.py`,
  `sfx/`, `paths.mjs`, `run_sfx.py`, `sheet.mjs`, `wave.mjs`. Licence: `THIRD_PARTY/teardown-skill-LICENSE.txt`.
- `sims/singer-treadle-shared/`: the machine (kinematics, geometry, presenter, script, console, stage, live page logic, film logic).
- `sims/singer-treadle-live/` and `sims/singer-treadle-film/`: the two entry points.
- `docs/CONVENTIONS.md` (what the skill does, with quoted files and lines) and `docs/PLAN.md` (dimensions, timing, budgets, verification).
- Research notes: `docs/research/linkage-search.md` (the treadle geometry), `docs/research/source-notes.md` (how each fact was checked).
- The exhibit: sixteen parts with fixed ids, presented and ghosted, with callouts and an info card; the stitch-cycle strip; the
  brass console plate with RUN, PUMP, RESET, presser lift and two sliders; the idle tour (all sixteen parts, about 112 s).
- The film: 75 s at 60 fps, the drive chain and the stitch, with captions and a procedural score (`score.py`, −14 LUFS).
- `tools/`: timelines from the script, release copy, the registry cross-check, screenshots, the film driver, review sheets,
  and the Pages site generator (`tools/site.mjs`, which reads the exhibit's own texts and draws the stitch cycle from the solver).
- `tests/exhibit.spec.mjs` (eight Playwright tests) and `tests/CHECKLIST.md` (the manual checks).
- `docs/review/`: the review sheet of the film's beats (round 1) and `NOTES.md` with what was read and changed.

### Verified in this session

- `npm run build`: the live page builds at 0.99 MB; the film page builds too.
- `npx playwright test`: 8 of 8 pass. Coverage: no console errors, no network requests, WebGL created; sixteen keys with the fixed
  ids; each part opens, is screenshotted, resets, and every group returns home within 1e-4; opening B closes A first (the
  presenter's timeline); the idle tour starts after the threshold and input cancels it; the belt ratio, the stitches a minute,
  the needle at bottom dead centre when the shuttle hook passes, the 30 mm stroke, and the feed dog moving only while the needle
  is out of the cloth; determinism; the frame time under 20 ms.
- `node tools/crosscheck.mjs`: sixteen parts, sixteen keys, sixteen tour beats, the built page, the sixteen screenshots.
- The film: 75.1 s, 9 part openings, 325 stitches and 141 treadle cycles from the machine's own timing.

### Known limitations

- The GPU used for the checks was a discrete NVIDIA card. The brief asks for 60 fps on an integrated laptop GPU; that has not been
  measured. The quality tiers (`live.js` `QUALITY`) lower the pixel ratio and turn off the occlusion pass if the frame time drops.
- The decal-era attribution ("Sphinx", "Red Eye") is not stated: the search did not verify it (`docs/research/source-notes.md`).
- Two period facts (Elias Howe's 1846 needle, the Clark instalment attribution) are stated with their status in the research note.
- The film and the tour use a simplified model: the shuttle is a boat in a race, the thread is a tube through its guides, and the
  feed dog is a plain toothed bar. The geometry is procedural, not scanned from a real machine.
