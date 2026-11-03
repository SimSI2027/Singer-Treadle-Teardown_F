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

## Round 2: the encoder's output (`film-encoded-r2-1..3.png`)

These sheets are the final check the skill asks for: what the encoder wrote, one tile per beat, read at sheet scale. The
film is 1920 × 1080 at 60 fps, 75.1 s; the score is AAC, 48 kHz stereo, at −14.0 LUFS with a true peak of −2.2 dBFS.

What holds:

- The round-1 fixes hold in the encoded film. The treadle reads from above with its lattice plate, the callout labels do not
  collide, and the balance wheel, the arm shaft and the needle assembly read as the machine they are.
- The captions change with each part, and the closing caption shows at the end.
- The chain numbers climb with the speed ramp, and the strip's cursor follows the wheel.

What is still weak:

1. **Vibrating shuttle** (t ≈ 52.4–52.7). The boat is small. The slide plate reads as a white bar and the race as a dark block.
2. **Feed mechanism** (t ≈ 58.9–59.2). The feed dog and the rock shaft read as long grey rods; the dog's teeth are lost at this scale.
3. **Thread path** (t ≈ 65.6). The thread is a thin line, too fine to read against the ghosted head.

Plan for round 3: frame these three parts closer (a size override for the feed mechanism), enlarge the feed dog's teeth, and
thicken the thread tube. The timing does not change: it matches the script. Then read the three tiles again.

Caveat: these sheets are read at reduced scale. A full-size check of each beat (`--still T`) is still to do.

## Round 3: the film after the round-2 fixes (`film-r3c-t18.5.png`, `-t43.0.png`, `-t62.5.png`)

Three beats were read at full size, from the encoded film: 18.5 s (pitman rod), 43.0 s (needle assembly) and 62.5 s (thread
path). Round 2's three weak beats were then fixed. Along the way a bug that affected several parts was found and fixed.

Fixed:

1. **Moving rods were not drawn (a bug).** The needle bar, the needle, the take-up lever, the pitman rod, the arm-shaft link and
   the thread segments all stretch between two points. Their direction was computed by subtracting plain arrays, which gives NaN,
   so none of them was drawn. They are drawn now: the pitman runs from the treadle joint up to the crank pin, the needle assembly
   shows its bar, needle and take-up lever, and the thread path is continuous. The Playwright suite did not catch this, because it
   checks the solver and the group transforms, not what is drawn; the link transforms are now checked to be finite.
2. **Shuttle.** The callout that said "Race" pointed at the iron carrier block. It reads "Carrier: holds the shuttle in its race".
3. **Feed mechanism.** The dog was nickel on the pale ground and washed out. It is dark iron now, with larger teeth.
4. **Thread path.** The links were too thin to read. They are drawn about 5.6 mm across, against roughly 0.3 mm for real thread,
   so the route reads. This is a deliberate exaggeration for legibility.
5. **Captions were centred in 640 px, not on the screen.** The skill's stylesheet caps a `.cap` element at 96 rem, which is 640 px at
   this viewport, and our captions reused that class name. The captions are now `capbox`, full width.
6. **The tour button and chip in the film.** "TOURING · PRESS ANY KEY" overflowed its button, and an empty tour chip showed at the top
   centre. The film no longer shows the tour state; on the live page the button reads "TOURING".
7. **An empty hint box** showed at the bottom centre. It is hidden when there is no hint.

Still open:

- At film scale the feed dog is small, and its teeth are not resolved in the frame. A dedicated close-up still would show them.
- The frames are read from the encoded file at 1920 px wide, not at the native resolution of the live page.

Review record: three rounds. Round 1 read the pre-fix sheet; round 2 read the encoder's output; round 3 (this round) read the final
encoded frames at full size. The film is 75.1 s, 1920 × 1080, at 60 fps, with the score at −14 LUFS.
