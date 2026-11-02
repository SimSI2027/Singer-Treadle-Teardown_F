#!/usr/bin/env python3
"""
Synthesises the exhibit's two sounds, deterministically (fixed seed, standard library only), and
encodes them to Ogg Vorbis with ffmpeg:

  snd/click.ogg  a brass push-button: two damped partials and a 3 ms contact transient (70 ms)
  snd/slide.ogg  a soft mechanical slide: band-limited noise under a slow swell (0.9 s)

Following the reference kit's rule "accent, never narrate": these mark the press and the start of a
transition; continuous motion (sway, RUN) stays silent.

Usage: python tools/make_sounds.py        (needs ffmpeg on PATH, or FFMPEG=/path/to/ffmpeg)
"""
import math
import os
import random
import struct
import subprocess
import tempfile
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")


def click():
    rng = random.Random(1885)
    n = int(SR * 0.07)
    out = []
    for i in range(n):
        t = i / SR
        body = 0.55 * math.sin(2 * math.pi * 2180 * t) * math.exp(-t * 95) \
            + 0.32 * math.sin(2 * math.pi * 3460 * t + 0.7) * math.exp(-t * 140) \
            + 0.18 * math.sin(2 * math.pi * 740 * t) * math.exp(-t * 60)
        transient = (rng.random() * 2 - 1) * math.exp(-t * 900) * 0.6
        out.append(body + transient)
    return out


def slide():
    rng = random.Random(1851)
    n = int(SR * 0.9)
    out = []
    lp1 = lp2 = 0.0
    for i in range(n):
        t = i / SR
        x = rng.random() * 2 - 1
        lp1 += 0.06 * (x - lp1)            # two one-pole low-passes: a soft "shhh"
        lp2 += 0.06 * (lp1 - lp2)
        env = math.sin(math.pi * min(1.0, t / 0.9)) ** 1.6
        rumble = 0.25 * math.sin(2 * math.pi * 62 * t) * env
        out.append((lp2 * 3.2 + rumble) * env)
    return out


def write(name, samples, peak=0.7):
    m = max(abs(s) for s in samples) or 1.0
    k = peak / m
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, name + ".wav")
        with wave.open(wav, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s * k)) * 32767)) for s in samples))
        out = os.path.join(ROOT, "snd", name + ".ogg")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-q:a", "5",
                        "-fflags", "+bitexact", "-flags:a", "+bitexact", out], check=True)
        print("wrote", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    write("click", click())
    write("slide", slide(), peak=0.5)
