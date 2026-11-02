#!/usr/bin/env python3
"""
Cross-checks prefab.xml against the SUBSYSTEMS table in exhibit.lua (no Lua runtime needed).

  * every sys=<id> tag appears on exactly one <body>
  * every subsystem id has exactly one btn=<id> button shape (plus btn=reset, btn=run)
  * the ids in the Lua SUBSYSTEMS table equal the ids in the XML, in both directions
  * every 'connects' entry in the Lua table names a real subsystem
  * every vox file referenced by the XML exists

Usage: python tools/crosscheck.py      (exit code 1 on any mismatch)
"""
import os
import re
import sys
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def tags(el):
    return dict(p.split("=", 1) if "=" in p else (p, "") for p in (el.get("tags") or "").split())


def main():
    root = ET.parse(os.path.join(ROOT, "prefab.xml")).getroot()
    sys_ids = [tags(b)["sys"] for b in root.iter("body") if "sys" in tags(b)]
    btn_ids = [tags(v)["btn"] for v in root.iter("vox") if "btn" in tags(v)]
    files = [v.get("file") for v in root.iter("vox")]
    lua = open(os.path.join(ROOT, "exhibit.lua"), encoding="utf-8").read()
    table = lua[lua.index("local SUBSYSTEMS = {"):lua.index("-- 3. GEOMETRY")]
    lua_ids = re.findall(r'\bid = "([a-z_]+)"', table)
    connects = re.findall(r'connects = \{([^}]*)\}', table)
    problems = []
    for i in set(sys_ids):
        if sys_ids.count(i) != 1:
            problems.append("sys=%s on %d bodies" % (i, sys_ids.count(i)))
        if btn_ids.count(i) != 1:
            problems.append("btn=%s on %d shapes" % (i, btn_ids.count(i)))
    for extra in ("reset", "run"):
        if btn_ids.count(extra) != 1:
            problems.append("btn=%s missing" % extra)
    if sorted(lua_ids) != sorted(sys_ids):
        problems.append("Lua ids vs XML ids differ: %s" % sorted(set(lua_ids) ^ set(sys_ids)))
    for c in connects:
        for name in re.findall(r'"([a-z_]+)"', c):
            if name not in lua_ids:
                problems.append("connects names unknown id %s" % name)
    for f in files:
        if not os.path.exists(os.path.join(ROOT, f.replace("MOD/", ""))):
            problems.append("missing file " + f)
    print("subsystems: %d in XML, %d in Lua; buttons: %d; vox files: %d" % (len(sys_ids), len(lua_ids), len(btn_ids), len(files)))
    for p in problems:
        print("  MISMATCH", p)
    print("crosscheck:", "OK" if not problems else "FAILED")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
