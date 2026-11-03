# Review notes

The review loop (`SKILL.md`): render the film's beats as a sheet, read every tile against the checklist, fix, re-render.
Each round records what was read and what changed.

## Round 1: `film-beats-r1.png` (the film, 20 beats, 1600 × 900)

What holds:

- Timing: the treadle opens at 8 s, as the script says; the captions change with the parts; the chain numbers climb with the
  speed ramp (240, then 300 stitches a minute); the stitch strip's cursor moves with the wheel.
- The sixteen-key plate highlights the open part; the part card shows the number, text, connections and the period fact.
- The head, the cabinet, the drawers, the balance wheel and the belt read as the machine they are.

What was wrong, and what changed:

1. **Shuttle beat.** The part was framed on its 14 cm slide plate, so the boat was a speck. Framing now uses the race and the
   boat (`machine.js`, `sizes.shuttle`); the slide plate still slides out when the part opens.
2. **Treadle beat.** The treadle was seen edge-on as a long bar. It is now rotated 15° and framed from above (`subsystems.js`,
   `cam` for `treadle`; `machine.js`, `sizes.treadle`), so the lattice foot plate reads.
3. **Callout labels collided** on the treadle (two labels on the same line). Labels are now pushed apart by at least 34 px
   (`console.js`, the callout pass).

Still open (not blocking):

- The ghosted machine is pale and busy behind a presented part; a stronger ghost would help the thread and feed beats.
- The thread path and the feed dog are small in their beats; a closer camera for the feed would help.
- Frames are read at sheet scale. The next round checks each beat at full size (`--still T`).
