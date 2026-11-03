# Manual checklist: the browser exhibit

The automated suite (`npm test`) covers the mechanics. This list covers what a person should look at before a release.
Open `dist/singer-treadle.html` from disk, with the network tab open, in a desktop browser and on a phone.

## Load

- [ ] The page opens from `file://` with no network requests and no console errors (devtools, console tab).
- [ ] The machine is visible at once on first load (frame 0 is not blank), and the console is readable.
- [ ] Turned sideways on a phone, the console fits; in portrait the note asks to turn the phone.

## Parts

- [ ] Each of the sixteen keys opens its part; the card shows the matching number, name, text and period fact.
- [ ] Opening a second part closes the first before the second comes forward (no overlap, no jump).
- [ ] Pressing the open part's key again closes it; RESET returns the whole machine to its home pose.
- [ ] While a part is on display the rest of the machine is ghosted, and the part keeps moving.
- [ ] Callout labels sit beside their parts and do not overlap each other or the card.
- [ ] Hovering a key outlines that part in the scene (the red box).

## Motion

- [ ] RUN spins the balance wheel; the band wheel turns at 0.43 of its speed; the treadle rocks about ±12°.
- [ ] The needle goes up and down 30 mm per turn; the take-up lever leads it; the shuttle swings as the needle reaches the bottom.
- [ ] The feed dog rises through the plate only while the needle is out of the cloth.
- [ ] Dragging the balance wheel scrubs the stitch; the numbers on the left follow it.
- [ ] The speed slider goes from rest to 900 stitches a minute and back without a jump.

## Idle tour

- [ ] After 25 s without input the tour starts, and its captions appear with each part.
- [ ] Any click, drag, wheel turn or key stops the tour at once; the machine keeps the state it had.

## Film

- [ ] `docs/assets/film.mp4` plays with its score, from the start to the end, with no clicks or silent gaps.
- [ ] Each caption is read in time (the last caption fades before the overview's closing beat).

## Site

- [ ] The project page loads the embedded exhibit; the links to the film, the source and the changelog work.
- [ ] The page reads on a phone (16 px side gutters, no sideways scrolling).
