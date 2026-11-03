"""Score for the Singer treadle film: a quiet motor bed, a whir of the balance wheel that swells with the speed, a clack
per treadle cycle, a tick per stitch with a breath of shuttle hiss, and one soft chime when a part comes forward.

Run from the repository root:   python run_sfx.py sims/singer-treadle-shared/score.py
Every time comes from sims/singer-treadle-film/score-timeline.json, which tools/timeline.mjs writes from the script.
"""

import os

from sfx.score_kit import airy, hiss, hz, motor, thud
from sfx.synth import chime, click

TIMELINE = "../singer-treadle-film/score-timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "singer-treadle-score.wav")
TARGET_LUFS = -14.0
SEED = 21


def score(mix, tl):
    dur = tl["duration"]
    speed = tl["speed"]  # stitches a minute, sampled every 0.5 s

    def rpm_at(t):
        return speed[min(len(speed) - 1, int(t / 0.5))]

    # the machine's hum: one quiet bed under the whole film
    mix.put(0.0, motor(dur, f0=96, grit_hz=900, wobble=5), 0.010)

    # the balance wheel's whir: a burst each second, louder with the speed
    t = 0.0
    while t < dur - 1.0:
        r = rpm_at(t)
        if r > 10:
            mix.put(t, airy(0.9, 520, 1100, 0.6), 0.003 + 0.018 * min(1.0, r / 420.0))
        t += 1.0

    # one tick per stitch, a breath of shuttle hiss under it
    for t in tl["stitches"]:
        mix.put(t, click(2600, 0.012), 0.018)
        mix.put(t + 0.02, hiss(0.05, 6000, 0.5), 0.0035)

    # one clack per treadle cycle (one turn of the band wheel)
    for t in tl["treadles"]:
        mix.put(t, thud(70, 0.06, 0.18), 0.045)

    # a soft chime when a part comes forward: one tonal sound per part, nothing narrated
    for t in tl["opens"]:
        mix.put(t, chime([hz("E5"), hz("A5")], 1.6, 0.6), 0.035)
