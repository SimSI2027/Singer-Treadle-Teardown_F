# Roadmap

## Next

- **In-game verification pass**: load in Teardown, run `tests/CHECKLIST.md`, and replace the web-edition
  screenshots with in-game captures. The engine-level assumptions listed in `docs/CONVENTIONS.md` §12
  (vox pivot, `scale="0.1"`, palette ranges, emissive MATL) get confirmed or tuned here.
- **Engraved labels**: put subsystem names on the console's label strips (half-scale voxel text).
- **Stitch-formation view**: a slow-motion RUN variant that shows the needle loop being caught by the
  shuttle, with the thread drawn as a moving path.

## Later

- **Belt that moves**: animate the belt as a travelling texture of leather marks during RUN.
- **Audio during RUN**: a quiet treadle clatter keyed to the crank angle (still one input).
- **More machines**: the generator's primitive library (wheels, gears, lattice, text) is general;
  an oscillating-shuttle Singer 66 would reuse most of it.
- **Localisation** of the exhibit texts.

## Done

- 1.0.0: complete exhibit, RUN mode, offline test suite, web edition, documentation.
