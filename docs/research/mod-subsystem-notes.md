# Subsystem texts from the Teardown-mod exhibit (archived)

Extracted from the old `exhibit.lua` `SUBSYSTEMS` table (git history, last version at commit `1ff9b38`).
The rebuilt exhibit writes its own texts in `sims/singer-treadle-shared/subsystems.js`. Re-verify any
historical fact here before reusing it.

## needle_assembly: Needle Assembly

**Text.** The needle bar is a hardened steel rod sliding in a bronze bushing in the needle end of the arm. A crank on the front of the arm shaft drives it one full stroke per revolution: going down, the needle carries the upper thread through the cloth; rising, it leaves a loop beside its eye for the shuttle to enter. The take-up lever above then draws the stitch tight.

**Connects.** crankshaft, thread_guide_path, shuttle, presser_foot

**Period fact.** The eye-pointed needle working with a shuttle was the heart of Elias Howe's 1846 patent. Singer paid royalties on it through the 1856 'Sewing Machine Combination' patent pool.

## presser_foot: Presser Foot

**Text.** The spring-loaded presser bar holds the cloth flat against the feed dog so every stitch pulls tight and the work advances evenly. The thumb screw on top sets the spring pressure for fine or heavy goods; the lifter lever at the back raises the foot to put work in or take it out.

**Connects.** needle_assembly, gear_train, machine_head

**Period fact.** Isaac Singer's 1851 machine stood out for its straight needle moving vertically and a spring presser foot holding the cloth, a departure from the curved needles of earlier designs.

## bobbin: Bobbin & Winder

**Text.** The winder fills the bobbin that rides inside the shuttle. Its rubber tyre is pressed against the moving belt, spinning the spindle while thread is laid on; the stop latch trips the tyre away when the bobbin is full. Loosening the balance-wheel knob lets the bobbin be wound without running the needle.

**Connects.** belt_drive, shuttle, drive_wheel

**Period fact.** A vibrating-shuttle bobbin is a long slender cylinder, not the flat round bobbin of later rotary hooks, because it must fit inside the boat-shaped shuttle.

## shuttle: Vibrating Shuttle

**Text.** A boat-shaped steel shuttle carrying the bobbin swings back and forth along a curved race under the needle plate. Each stitch, its pointed nose passes through the loop of upper thread and wraps it around the lower thread, locking the stitch. It travels a short arc, so Singer called it a 'vibrating' shuttle, unlike the oscillating shuttle (as in the Singer 15), whose hook rocks around a round bobbin case.

**Connects.** needle_assembly, gear_train, crankshaft, bobbin

**Period fact.** Vibrating-shuttle Singers such as the Model 27 were built by the million in the late 19th century at Elizabethport, New Jersey and Kilbowie, Scotland.

## drive_wheel: Balance Wheel

**Text.** The balance (hand) wheel on the right of the arm is both pulley and flywheel. The belt from the stand turns it, and its mass smooths the uneven push of the treadle. The stop-motion knob in the centre clamps it to the arm shaft; slacken the knob and the wheel spins freely to wind a bobbin.

**Connects.** belt_drive, crankshaft, bobbin

**Period fact.** Instruction books told operators to start the machine by turning the balance wheel toward them by hand. Starting backward snarls or breaks the thread.

## belt_drive: Belt Drive & Band Wheel

**Text.** A round leather belt runs from the groove of the heavy band wheel in the stand, up through the table, to the groove of the balance wheel. The band wheel's groove is 2.5 times the radius of the balance wheel's, so each turn of the treadle crank spins the machine 2.5 times. A steel belt hook joins the ends.

**Connects.** pitman_rod, drive_wheel, bobbin, cabinet

**Period fact.** Treadle belts stretch. The usual repair was to cut out a short length, punch a new hole and crimp the hook closed with pliers.

## treadle: Treadle

**Text.** The cast-iron treadle is a foot lever rocking on two pointed pivot screws set in the side frames. Rocking it heel-and-toe pushes the pitman rod up and down, which turns the crank on the band wheel: oscillation in, continuous rotation out. The open lattice saves iron while keeping the plate stiff.

**Connects.** pitman_rod, cabinet, belt_drive

**Period fact.** A practised operator treads about 60 to 100 times a minute. With this machine's 2.5:1 belt ratio that is roughly 150 to 250 stitches a minute.

## pitman_rod: Pitman Rod

**Text.** The pitman is the connecting rod between the treadle and the crank pin on the band wheel. Its brass ball-and-socket ends let it swing as the crank pin travels in a circle while the treadle only rocks, the same slider-crank idea as a steam engine, run backwards by a foot.

**Connects.** treadle, belt_drive

**Period fact.** The name comes from pit-sawing: the 'pitman' worked the lower end of the saw from inside the saw pit, and the word passed to any rod linking a crank to a reciprocating part.

## crankshaft: Arm Shaft & Crank

**Text.** The arm shaft runs the length of the arm in bronze bushings, from the balance wheel to the needle end. The crank disc on its front end drives the needle bar, its counterweight balances the needle bar's mass, and an eccentric along the shaft works the feed and the shuttle drive below. One turn of this shaft is exactly one stitch.

**Connects.** drive_wheel, needle_assembly, gear_train, shuttle

**Period fact.** Machines of this period were oiled through small holes along the top of the arm, one for every bushing on this shaft. The instruction book called for oil daily in regular use.

## gear_train: Feed Mechanism

**Text.** Under the bed, a cam and an eccentric work a rock shaft that moves the toothed feed dog through a four-motion cycle: up through the needle plate, back one stitch length carrying the cloth, down below the plate, and forward to begin again. The exhibit spreads the parts apart so each can be seen.

**Connects.** crankshaft, shuttle, presser_foot

**Period fact.** Allen B. Wilson patented the four-motion feed in 1854. Vibrating-shuttle Singers drove their lower shafts through a crank and rod inside the pillar; later rotary machines used bevel gears like the pair shown.

## tension_regulator: Tension Regulator

**Text.** The upper thread passes between two polished discs squeezed by a coil spring. Turning the thumb nut changes the spring pressure, and so the drag on the thread. Balanced against the bobbin's tension, it places the lock of each stitch in the middle of the cloth. The small check spring takes up slack as the needle descends.

**Connects.** thread_guide_path, spool_pin, needle_assembly

**Period fact.** Period instruction books gave the rule: loops on the underside mean the upper tension is too loose, loops on top mean it is too tight.

## spool_pin: Spool Pin

**Text.** A vertical steel pin on top of the arm carries the spool of upper thread. The felt pad beneath the spool adds a little drag so it cannot overrun and tangle when the machine stops suddenly.

**Connects.** thread_guide_path, tension_regulator

**Period fact.** Six-cord cotton thread was introduced in the 1860s specifically for sewing machines; softer hand-sewing thread untwisted under the shuttle's action.

## thread_guide_path: Thread Path

**Text.** The upper thread's route, laid out as a map: spool, arm guide, face-plate guide, between the tension discs, round the check spring, up through the take-up lever's eye, down through the lower guide and the needle-bar guide, and finally through the needle's eye.

**Connects.** spool_pin, tension_regulator, needle_assembly

**Period fact.** Missing the take-up lever was the classic threading mistake, which is why every instruction book printed a numbered threading diagram much like this one.

## machine_head: Machine Head

**Text.** The cast-iron head is the machine's skeleton: bed plate below, pillar on the right, overhanging arm above, holding every moving part in alignment. It was finished in black japan, a baked asphalt varnish, and decorated with gold decals. Here the arm and needle end are shown sectioned so the internal parts can be withdrawn.

**Connects.** crankshaft, needle_assembly, presser_foot, shuttle, cabinet

**Period fact.** Collectors still use the names of Singer's decal sets: 'Sphinx', 'Victorian', 'Tiffany', 'Red Eye'. A head's serial number dates it to within a year or two.

## cabinet: Cabinet & Stand

**Text.** Oak table and cast-iron stand. The side frames carry the treadle on pointed pivot screws and the band wheel on its crank axle; the cast 'SINGER' lattice keeps them light but stiff. The table top holds the head, and the drop leaf folds out for a wider work surface.

**Connects.** treadle, belt_drive, drawers, machine_head

**Period fact.** Singer sold machines on instalments from the 1850s, a few dollars down and a few a month, which is how an outfit costing weeks of wages reached ordinary homes.

## drawers: Drawers

**Text.** Oak drawers on the left held needles, bobbins, attachments and the instruction book; the centre drop-front swings down for knee room and access under the machine. Here they slide open about 60 percent.

**Connects.** cabinet

**Period fact.** Treadle outfits were usually sold with a box of attachments (ruffler, tucker, hemmers, binder), and these drawers were where they lived.

