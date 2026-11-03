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
