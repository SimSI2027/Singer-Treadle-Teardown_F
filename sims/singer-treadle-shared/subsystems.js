// The sixteen subsystems: fixed ids, button labels, open-view presets, callout anchors, texts and period facts.
// Pure data. The ids are used everywhere (buttons, keys, tour beats, film, tests, crosscheck), so they never change.
//
// Open views: "move" subsystems leave the machine and come forward to the display point (pivot → display, rotated by
// `rot`, scaled by `scale`, with an `out` bow in the home frame); "inplace" subsystems stay where they are and the camera
// comes to them (the cabinet and the drawers). `cam` = {az, el, d, t}: az 0 is the operator's side (+z), t the target.
// Callout `at` points are in home (machine) coordinates, metres.

export const DISPLAY = [0.0, 0.93, 0.34]; // where a moved subsystem presents itself: in front of the head, above the table
export const OVERVIEW = {t: [0.0, 0.53, -0.02], az: 26, el: 12, d: 4.0};

export const SUBSYSTEMS = [
  {
    id: 'needle_assembly', n: 1, button: 'NEEDLE', name: 'Needle Assembly',
    mode: 'move', pivot: [-0.09, 0.9, -0.02], rot: [0, 0, 0], scale: 2.4, out: [0.0, 0.0, 0.12],
    hint: 'vertical, rotated to show the clamp',
    cam: {az: 18, el: 9, d: 0.82, t: [0, 0.93, 0.34]},
    callouts: [
      {label: 'Needle bar', sub: 'one 30 mm stroke per turn', at: [-0.09, 0.9, -0.02]},
      {label: 'Take-up lever', sub: 'draws the stitch tight', at: [0.0, 1.0, 0.07]},
      {label: 'Needle', sub: 'eye at the point', at: [-0.09, 0.82, -0.02]},
    ],
    connects: ['crankshaft', 'thread_guide_path', 'shuttle', 'presser_foot'],
    text: 'The needle bar slides up and down in the arm\'s front bushing. A crank pin on the arm shaft and a short link drive it through one 30 mm stroke per turn. Going down, the needle carries the upper thread through the cloth; rising, it leaves a loop for the shuttle to catch.',
    fact: 'Elias Howe\'s 1846 patent used an eye-pointed needle: the eye sits near the point, so the thread goes down through the cloth first.',
  },
  {
    id: 'presser_foot', n: 2, button: 'PRESSER', name: 'Presser Foot',
    mode: 'move', pivot: [-0.1, 0.86, -0.02], rot: [0, 0, 0], scale: 2.6, out: [0.0, 0.1, 0.0],
    hint: 'foot facing the visitor',
    cam: {az: 0, el: 6, d: 0.74, t: [0, 0.93, 0.34]},
    callouts: [
      {label: 'Presser bar', sub: 'spring-loaded', at: [-0.135, 0.95, -0.02]},
      {label: 'Presser foot', sub: 'holds the cloth on the feed dog', at: [-0.09, 0.82, -0.02]},
      {label: 'Lifter lever', sub: 'raises the foot', at: [-0.13, 0.99, -0.02]},
    ],
    connects: ['needle_assembly', 'gear_train', 'machine_head'],
    text: 'A spring-loaded presser bar holds the cloth flat on the feed dog, so the work moves in step with every stitch. The thumb screw on top sets the pressure for thin or heavy fabric. The lifter lever raises the foot to slip the work in and out.',
    fact: 'Machines of the period were sold with a set of feet, the plain foot, the hemmer and the ruffler, all of which clamp to the same presser bar.',
  },
  {
    id: 'bobbin', n: 3, button: 'BOBBIN', name: 'Bobbin & Winder',
    mode: 'move', pivot: [0.2, 1.1, -0.06], rot: [20, 25, 0], scale: 2.6, out: [0.0, 0.1, 0.05],
    hint: 'winder angled',
    cam: {az: 30, el: 18, d: 0.7, t: [0, 0.93, 0.34]},
    callouts: [
      {label: 'Bobbin', sub: 'long, to fit the shuttle', at: [0.2, 1.12, -0.06]},
      {label: 'Rubber tyre', sub: 'driven by the balance wheel', at: [0.23, 1.08, -0.06]},
      {label: 'Winder stop', sub: 'trips the tyre off when full', at: [0.17, 1.13, -0.04]},
    ],
    connects: ['drive_wheel', 'shuttle', 'belt_drive'],
    text: 'The bobbin winder fills the bobbin that sits inside the shuttle. Its rubber tyre runs against the balance wheel, so the bobbin spins while thread is laid on. A stop trips the tyre clear when the bobbin is full.',
    fact: 'A vibrating-shuttle bobbin is a long slender cylinder, because it has to fit inside the boat-shaped shuttle.',
  },
  {
    id: 'shuttle', n: 4, button: 'SHUTTLE', name: 'Vibrating Shuttle',
    mode: 'move', pivot: [-0.06, 0.8, -0.02], rot: [-68, 0, 0], scale: 3.4, out: [0.0, -0.05, 0.12],
    hint: 'race opened toward the visitor',
    cam: {az: 0, el: 40, d: 0.5, t: [0, 0.93, 0.34]},
    callouts: [
      {label: 'Shuttle', sub: 'oscillates in the race', at: [-0.09, 0.8, -0.02]},
      {label: 'Race', sub: 'the curved track it swings in', at: [-0.06, 0.8, -0.02]},
      {label: 'Slide plate', sub: 'removed for access', at: [-0.07, 0.79, 0.07]},
    ],
    connects: ['needle_assembly', 'bobbin', 'gear_train', 'crankshaft'],
    text: 'The boat-shaped shuttle carries the lower thread on its bobbin. It swings back and forth in a curved race, its point sweeping through the loop the needle leaves at the bottom of its stroke, so the two threads lock. One swing is one stitch.',
    fact: 'The model 27 vibrating-shuttle machine was built from 1891 to 1913, and its updated successor, the 127, from about 1910.',
  },
  {
    id: 'drive_wheel', n: 5, button: 'BALANCE', name: 'Balance Wheel',
    mode: 'move', pivot: [0.5, 1.0, -0.02], rot: [0, 90, 0], scale: 1.9, out: [0.1, 0.0, 0.0],
    hint: 'face-on, spinning',
    cam: {az: 0, el: 0, d: 0.5, t: [0, 0.93, 0.34]},
    callouts: [
      {label: 'Balance wheel', sub: 'one turn = one stitch', at: [0.5, 1.0, -0.02]},
      {label: 'Hub', sub: 'on the arm shaft', at: [0.5, 1.0, -0.02]},
      {label: 'Stop-motion knob', sub: 'in the hub', at: [0.52, 1.0, -0.02]},
    ],
    connects: ['belt_drive', 'crankshaft', 'bobbin', 'needle_assembly'],
    text: 'The balance wheel sits on the end of the arm shaft, and one turn of it makes one stitch. Its heavy rim balances the needle bar and the arm, so the head runs smoothly. Operators turn it toward themselves to start the machine.',
    fact: 'Instruction books told operators to turn the balance wheel toward them to start. Turning it the other way could snarl or break the thread.',
  },
  {
    id: 'belt_drive', n: 6, button: 'BELT', name: 'Belt Drive & Band Wheel',
    mode: 'move', pivot: [0.5, 0.34, -0.14], rot: [0, 90, 0], scale: 1.5, out: [0.12, 0.0, 0.0],
    hint: 'loop visible, moving',
    cam: {az: 0, el: 4, d: 0.8, t: [0, 0.93, 0.34]},
    callouts: [
      {label: 'Band wheel', sub: 'Ø 0.30 m, turned by the treadle', at: [0.5, 0.34, -0.14]},
      {label: 'Leather belt', sub: 'about 4 m/s at 600 stitches a minute', at: [0.5, 0.7, -0.07]},
      {label: 'Belt hook', sub: 'keeps the belt on the wheel', at: [0.5, 0.52, -0.1]},
    ],
    connects: ['treadle', 'pitman_rod', 'drive_wheel', 'bobbin'],
    text: 'A leather belt carries the drive from the big band wheel under the table to the balance wheel. The band wheel is 2.31 times the balance wheel\'s diameter, so the balance wheel turns 2.31 times for each turn of the band wheel. A belt hook keeps the belt from riding off.',
    fact: 'Leather belts stretched in use, and the usual repair was to cut out a short length and rejoin the ends.',
  },
  {
    id: 'treadle', n: 7, button: 'TREADLE', name: 'Treadle',
    mode: 'move', pivot: [0.44, 0.05, -0.02], rot: [-20, 0, 0], scale: 1.5, out: [0.0, -0.05, 0.1],
    hint: 'tilted 20°, rocking',
    cam: {az: 18, el: 10, d: 0.95, t: [0, 0.93, 0.34]},
    callouts: [
      {label: 'Treadle', sub: 'rocks about 24°, end to end', at: [0.44, 0.05, 0.1]},
      {label: 'Pivot rod', sub: 'on the stand\'s side arm', at: [0.44, 0.05, -0.02]},
      {label: 'Foot pad', sub: 'the operator\'s foot pushes here', at: [0.44, 0.05, 0.16]},
    ],
    connects: ['pitman_rod', 'belt_drive', 'cabinet'],
    text: 'The operator\'s foot presses the treadle, which rocks about a pivot rod through about 24 degrees. The pitman rod turns that rocking into the rotation of the band wheel. The treadle, pitman, crank and wheel form a four-bar linkage that gives a smooth stroke.',
    fact: 'One treadle cycle is one turn of the band wheel, which is 2.31 turns of the balance wheel: at 60 treads a minute the needle makes about 139 stitches a minute.',
  },
  {
    id: 'pitman_rod', n: 8, button: 'PITMAN', name: 'Pitman Rod',
    mode: 'move', pivot: [0.465, 0.2, -0.08], rot: [0, 0, 0], scale: 2.4, out: [0.1, 0.0, 0.0],
    hint: 'diagonal, following the crank',
    cam: {az: 40, el: 10, d: 0.85, t: [0, 0.93, 0.34]},
    callouts: [
      {label: 'Pitman rod', sub: 'a ball joint at each end', at: [0.465, 0.2, -0.08]},
      {label: 'Crank pin', sub: 'on the band wheel hub', at: [0.475, 0.3, -0.14]},
      {label: 'Treadle joint', sub: 'carries the rocking motion', at: [0.455, 0.07, -0.28]},
    ],
    connects: ['treadle', 'belt_drive'],
    text: 'The pitman is a steel rod with a ball joint at each end. It carries the treadle\'s rocking to a crank pin on the band wheel hub, and turns that into a full revolution of the wheel. Its joints let it swing through the angle the crank and the treadle need.',
    fact: 'The word pitman comes from pit-sawing, where the pitman worked the lower end of a saw from inside the pit. The name stuck to any rod that turns a crank.',
  },
  {
    id: 'crankshaft', n: 9, button: 'ARM SHAFT', name: 'Arm Shaft & Crank',
    mode: 'move', pivot: [0.1, 1.0, -0.02], rot: [0, -20, 0], scale: 1.8, out: [0.0, 0.14, 0.0],
    hint: 'horizontal, exploded',
    cam: {az: 20, el: 14, d: 0.95, t: [0, 0.93, 0.34]},
    callouts: [
      {label: 'Arm shaft', sub: 'turns once per stitch', at: [0.1, 1.0, -0.02]},
      {label: 'Crank disc', sub: 'drives the needle bar', at: [-0.07, 1.0, -0.02]},
      {label: 'Counterweight', sub: 'balances the crank', at: [0.0, 1.0, -0.02]},
    ],
    connects: ['drive_wheel', 'needle_assembly', 'shuttle', 'gear_train', 'tension_regulator'],
    text: 'The arm shaft runs the length of the arm. Its crank drives the needle bar through a link; an eccentric on the same shaft drives the take-up lever. A counterweight balances the crank, so the head runs without shaking.',
    fact: 'Machines of the period were oiled through small holes along the top of the arm, one for each bearing on the shaft.',
  },
  {
    id: 'gear_train', n: 10, button: 'FEED', name: 'Feed Mechanism',
    mode: 'move', pivot: [-0.09, 0.8, -0.02], rot: [-55, 0, 0], scale: 2.6, out: [0.0, 0.0, 0.14],
    hint: 'exploded so the cams are visible',
    cam: {az: 0, el: 30, d: 0.55, t: [0, 0.93, 0.34]},
    callouts: [
      {label: 'Feed dog', sub: 'moves the cloth 2.5 mm a stitch', at: [-0.09, 0.812, -0.02]},
      {label: 'Feed cam', sub: 'eccentric on the shaft', at: [-0.09, 0.7, -0.02]},
      {label: 'Rock shaft', sub: 'carries the dog up, forward, down, back', at: [-0.09, 0.75, 0.05]},
    ],
    connects: ['presser_foot', 'needle_assembly', 'shuttle'],
    text: 'The four-motion feed is a toothed dog under the throat plate. Each stitch it rises through the plate, moves the cloth forward by the stitch length, drops and returns. Its teeth touch the cloth only while the needle is out of it.',
    fact: 'Allen B. Wilson patented the four-motion feed on 19 December 1854 (US patent 12,116).',
  },
  {
    id: 'tension_regulator', n: 11, button: 'TENSION', name: 'Tension Regulator',
    mode: 'move', pivot: [-0.035, 1.02, 0.075], rot: [0, 0, 0], scale: 3.2, out: [0.0, 0.0, 0.08],
    hint: 'face-on, exploded axially',
    cam: {az: 0, el: 8, d: 0.52, t: [0, 0.93, 0.34]},
    callouts: [
      {label: 'Tension discs', sub: 'clamp the upper thread', at: [-0.035, 1.02, 0.075]},
      {label: 'Tension spring', sub: 'sets the pressure', at: [-0.035, 1.05, 0.075]},
      {label: 'Thumb nut', sub: 'the adjustment', at: [-0.035, 1.07, 0.075]},
    ],
    connects: ['spool_pin', 'thread_guide_path', 'needle_assembly'],
    text: 'Two discs clamp the upper thread between them. A spring presses them together, and the thumb nut sets the pressure. Too tight and the stitch puckers the cloth; too loose and loops show on the underside.',
    fact: 'Instruction books gave a simple rule: loops on the underside mean the upper tension is too loose, and loops on top mean it is too tight.',
  },
  {
    id: 'spool_pin', n: 12, button: 'SPOOL', name: 'Spool Pin',
    mode: 'move', pivot: [-0.12, 1.1, -0.1], rot: [0, 0, 0], scale: 2.4, out: [0.0, 0.1, 0.0],
    hint: 'vertical',
    cam: {az: 0, el: 12, d: 0.9, t: [0, 0.93, 0.34]},
    callouts: [
      {label: 'Spool pin', sub: 'holds the spool upright', at: [-0.12, 1.12, -0.1]},
      {label: 'Felt pad', sub: 'a light drag on the thread', at: [-0.12, 1.07, -0.1]},
      {label: 'Spool', sub: 'the thread wound on wood', at: [-0.12, 1.11, -0.1]},
    ],
    connects: ['tension_regulator', 'thread_guide_path'],
    text: 'The vertical spool pin holds a wooden spool of thread. A felt pad under the spool gives a light, steady drag, so the thread comes off evenly instead of spilling as the needle pulls.',
    fact: 'A machine spool is a wooden barrel with flanges at each end, made to sit on a pin and turn freely as the thread is drawn off.',
  },
  {
    id: 'thread_guide_path', n: 13, button: 'THREAD', name: 'Thread Path',
    mode: 'move', pivot: [-0.05, 1.0, 0.0], rot: [0, 0, 0], scale: 1.9, out: [0.0, 0.1, 0.0],
    hint: 'flat map, animated flow',
    cam: {az: 0, el: 6, d: 1.1, t: [0, 0.93, 0.34]},
    callouts: [
      {label: 'Spool', sub: 'start of the path', at: [-0.12, 1.12, -0.1]},
      {label: 'Tension', sub: 'the discs', at: [-0.035, 1.02, 0.075]},
      {label: 'Take-up eye', sub: 'pulls the loop up', at: [0.0, 1.0, 0.07]},
      {label: 'Needle eye', sub: 'the end of the path', at: [-0.09, 0.82, -0.02]},
    ],
    connects: ['spool_pin', 'tension_regulator', 'needle_assembly'],
    text: 'The upper thread runs from the spool through the tension discs and the guides, through the eye of the take-up lever, then down to the needle. The take-up lever draws out just enough thread at the right moment, so the stitch locks without puckering.',
    fact: 'Instruction books printed numbered threading diagrams because the take-up lever is easy to miss, and a thread that skips it will not form a stitch.',
  },
  {
    id: 'machine_head', n: 14, button: 'HEAD', name: 'Machine Head',
    mode: 'move', pivot: [0.1, 0.95, -0.02], rot: [0, -30, 0], scale: 1.3, out: [0.0, 0.2, 0.0],
    hint: '30° yaw, face plate swings open',
    cam: {az: -30, el: 14, d: 1.25, t: [0, 0.93, 0.34]},
    callouts: [
      {label: 'Arm', sub: 'carries the needle bar and the shaft', at: [0.0, 1.0, -0.02]},
      {label: 'Pillar', sub: 'rises from the bed', at: [0.33, 0.95, -0.02]},
      {label: 'Bed', sub: 'the gold-decorated base', at: [0.1, 0.78, -0.02]},
      {label: 'Face plate', sub: 'hinges open to oil the works', at: [-0.12, 1.0, 0.05]},
    ],
    connects: ['needle_assembly', 'presser_foot', 'crankshaft', 'cabinet'],
    text: 'The cast-iron head holds everything above the cloth: the bed with its needle plate, the pillar that rises from its back, and the arm that carries the needle bar and the arm shaft. The face plate hinges open so the works can be oiled and adjusted.',
    fact: 'Collectors identify heads by their gold decal patterns, and the decal style is a good first clue to a machine\'s age.',
  },
  {
    id: 'cabinet', n: 15, button: 'CABINET', name: 'Cabinet & Stand',
    mode: 'inplace', pivot: [0.0, 0.48, 0.0], rot: [0, 0, 0], scale: 1, out: [0, 0, 0],
    hint: 'as-is, orbit',
    cam: {az: 24, el: 12, d: 2.5, t: [0.0, 0.48, 0.0]},
    callouts: [
      {label: 'Oak top', sub: '0.90 × 0.45 m, 0.76 m high', at: [0.0, 0.76, 0.0]},
      {label: 'Drop leaf', sub: 'folds down the side', at: [-0.478, 0.5, 0.0]},
      {label: 'Standards', sub: 'cast iron with a lattice', at: [0.41, 0.4, -0.2]},
    ],
    connects: ['treadle', 'machine_head', 'drawers', 'pitman_rod'],
    text: 'The oak cabinet carries the machine on its top, with drawers below. Two cast-iron standards with an openwork lattice hold the cabinet and the treadle. The drop leaf folds down the side when the table is not in use.',
    fact: 'Singer sold machines on instalments. Its partner Edward Cabot Clark is usually credited with the 1856 plan, though some sources credit Isaac Singer.',
  },
  {
    id: 'drawers', n: 16, button: 'DRAWERS', name: 'Drawers',
    mode: 'inplace', pivot: [0.0, 0.45, 0.2], rot: [0, 0, 0], scale: 1, out: [0, 0, 0],
    hint: 'drawers slid open 60 %',
    cam: {az: 14, el: 10, d: 1.5, t: [0.0, 0.45, 0.18]},
    callouts: [
      {label: 'Drawer', sub: 'slides on wooden runners', at: [-0.26, 0.56, 0.2]},
      {label: 'Brass pull', sub: 'on each drawer', at: [-0.26, 0.58, 0.23]},
      {label: 'Drop front', sub: 'swings down as a work surface', at: [0.0, 0.5, 0.21]},
    ],
    connects: ['cabinet', 'presser_foot'],
    text: 'The drawers slide on wooden runners under the table, with brass pulls. The centre drop front swings down to make a small work surface. Treadle outfits were often sold with attachments, and these drawers were where those were kept.',
    fact: 'Treadle machines were often sold with a box of attachments such as the ruffler, the hemmer and the binder.',
  },
];

export const IDS = SUBSYSTEMS.map((s) => s.id);
export const BY_ID = Object.fromEntries(SUBSYSTEMS.map((s) => [s.id, s]));
export const BUTTON_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'q', 'w', 'e', 't', 'y', 'u'];
