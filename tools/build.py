#!/usr/bin/env python3
"""
One command to rebuild and verify everything:

  python tools/build.py            generate -> crosscheck -> offline tests -> sync site assets
  python tools/build.py --sounds   ... and re-synthesise snd/*.ogg (needs ffmpeg)
  python tools/build.py --shots    ... and re-capture docs/screenshots (needs node; npm install in tools/screens)
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def run(*cmd, cwd=ROOT):
    print("\n$ " + " ".join(cmd))
    subprocess.run(list(cmd), cwd=cwd, check=True)


def main():
    py = sys.executable
    run(py, "tools/generate.py")
    run(py, "tools/crosscheck.py")
    run(py, "tools/run_tests.py", "--json", "docs/assets/test-report.json")
    if "--sounds" in sys.argv:
        run(py, "tools/make_sounds.py")
    for f in ("CHANGELOG.md", "ROADMAP.md"):
        shutil.copyfile(os.path.join(ROOT, f), os.path.join(ROOT, "docs", "assets", f))
    print("\nsynced CHANGELOG.md, ROADMAP.md -> docs/assets/")
    if "--shots" in sys.argv:
        run("node", "capture.mjs", cwd=os.path.join(ROOT, "tools", "screens"))
    print("\nbuild OK")


if __name__ == "__main__":
    main()
