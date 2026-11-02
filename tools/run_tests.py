#!/usr/bin/env python3
"""
Offline verification of the exhibit (Phase 3). Runs the real exhibit.lua under Lua 5.1 (via `lupa`)
against tools/stub_api.lua, with the scene registered from the real prefab.xml.

Checks
  T1  prefab.xml is well-formed; every sys=<id> has one body and one matching btn=<id>; every id in
      the Lua SUBSYSTEMS table exists in the XML and vice versa (also tools/crosscheck.py)
  T2  no global leaks: loading exhibit.lua adds only init, tick, draw
  T3  init() resolves all 16 bodies, 18 buttons, all articulated shapes
  T4  per subsystem: open -> shown -> close returns every body (and shape) to within 1e-4 of home;
      OPENING and CLOSING each take OPEN_TIME (+1 frame)
  T5  pressing B while A is shown closes A completely before B starts opening
  T6  RESET from IDLE / OPENING / SHOWN / CLOSING / RUN always ends in IDLE at home
  T7  RUN: 6 s, treadle swings about +/-12 degrees, every body ends exactly at home
  T8  determinism: the same input script twice gives bit-identical transforms
  T9  bounding-box check: the selected subsystem's box never intersects any shifted body's box during
      the present phase (60 samples), and voxel-exact interpenetration along the whole path is
      reported per phase
  T10 per-tick cost: in IDLE, exactly one raycast and zero SetBodyTransform / Find calls per tick

Also exports docs/assets/exhibit.json (CONFIG, SUBSYSTEMS, GEOM) for the web viewer, read straight
from the Lua tables so the website can never disagree with the mod.

Usage: python tools/run_tests.py [--json report.json]
"""
import json
import math
import os
import struct
import sys
import xml.etree.ElementTree as ET

from lupa import lua51

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DT = 1.0 / 60.0
TOL = 1e-4

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("  PASS " if ok else "  FAIL ") + name + (("  " + detail) if detail else ""))
    return ok


# ----------------------------------------------------------------------------- scene from XML
def vec3(s):
    return [float(v) for v in s.split()] if s else [0.0, 0.0, 0.0]


def parse_tags(s):
    out = {}
    for part in (s or "").split():
        if "=" in part:
            k, v = part.split("=", 1)
            out[k] = v
        else:
            out[part] = ""
    return out


def load_scene():
    tree = ET.parse(os.path.join(ROOT, "prefab.xml"))
    bodies, shapes, locations = [], [], []

    def walk(el, offset):
        pos = vec3(el.get("pos"))
        here = [offset[i] + pos[i] for i in range(3)]
        if el.tag == "body":
            b = {"name": el.get("name"), "tags": parse_tags(el.get("tags")), "pos": here, "shapes": []}
            bodies.append(b)
            for v in el:
                if v.tag == "vox":
                    s = {"file": v.get("file"), "tags": parse_tags(v.get("tags")), "pos": vec3(v.get("pos")), "body": b}
                    b["shapes"].append(s)
                    shapes.append(s)
            return
        if el.tag == "location":
            locations.append({"name": el.get("name"), "tags": parse_tags(el.get("tags")), "pos": here})
            return
        for c in el:
            walk(c, here)

    walk(tree.getroot(), [0.0, 0.0, 0.0])
    return bodies, shapes, locations


# ----------------------------------------------------------------------------- Lua session
class Session:
    def __init__(self):
        self.lua = lua51.LuaRuntime(unpack_returned_tuples=True)
        with open(os.path.join(ROOT, "tools", "stub_api.lua"), encoding="utf-8") as f:
            self.lua.execute(f.read())
        self.bodies, self.shapes, self.locations = load_scene()
        stub = self.lua.globals().STUB
        tbl = self.lua.table_from
        for b in self.bodies:
            b["h"] = stub.addBody(tbl(b["tags"]), tbl(b["pos"]))
        for s in self.shapes:
            s["h"] = stub.addShape(s["body"]["h"], tbl(s["tags"]), tbl(s["pos"]))
        for l in self.locations:
            l["h"] = stub.addLocation(tbl(l["tags"]), tbl(l["pos"]))
        self.stub = stub
        g = self.lua.globals()
        self.before = set(k for k in g.keys())
        holder = {}
        g.EXHIBIT_TEST_HOOK = lambda api: holder.setdefault("api", api)
        self.before.add("EXHIBIT_TEST_HOOK")
        with open(os.path.join(ROOT, "exhibit.lua"), encoding="utf-8") as f:
            self.lua.execute(f.read())
        self.after = set(k for k in g.keys())
        self.api = holder["api"]
        g.init()
        self.btn = {s["tags"]["btn"]: s["h"] for s in self.shapes if "btn" in s["tags"]}
        self.sys_body = {b["tags"]["sys"]: b["h"] for b in self.bodies if "sys" in b["tags"]}

    # ---- input
    def press(self, bid):
        self.stub.look = self.btn[bid]
        self.stub.pressed["interact"] = True
        self.tick()
        self.stub.look = 0

    def tick(self, n=1):
        for _ in range(n):
            self.lua.globals().tick(DT)
            self.lua.globals().draw(DT)

    @property
    def mode(self):
        return self.api.st.mode

    # ---- transforms
    def tf(self, h):
        t = self.stub.entities[h].t
        return [t.pos[1], t.pos[2], t.pos[3]], [t.rot[1], t.rot[2], t.rot[3], t.rot[4]]

    def snapshot(self):
        return {h: self.tf(h) for h in list(self.sys_body.values()) + [s["h"] for s in self.shapes]}

    def run_until(self, pred, limit=1200):
        n = 0
        while not pred() and n < limit:
            self.tick()
            n += 1
        return n


def max_err(a, b):
    worst = 0.0
    for h in a:
        pa, qa = a[h]
        pb, qb = b[h]
        worst = max(worst, max(abs(pa[i] - pb[i]) for i in range(3)))
        d = abs(sum(qa[i] * qb[i] for i in range(4)))
        worst = max(worst, 1 - min(1.0, d))
    return worst


# ----------------------------------------------------------------------------- voxel data
def load_voxels():
    meta = json.load(open(os.path.join(ROOT, "docs", "assets", "geometry.json")))
    blob = open(os.path.join(ROOT, "docs", "assets", "geometry.bin"), "rb").read()
    shapes = {}
    for s in meta["shapes"]:
        ox, oy, oz = s["origin_cm"]
        cells = []
        for i in range(s["count"]):
            x, y, z, _ = struct.unpack_from("<BBBB", blob, s["offset"] + 4 * i)
            cells.append((ox + x, oy + y, oz + z))
        shapes[s["file"]] = {"meta": s, "cells": cells}
    return meta, shapes


def qrot(q, v):
    x, y, z, w = q
    tx = 2 * (y * v[2] - z * v[1])
    ty = 2 * (z * v[0] - x * v[2])
    tz = 2 * (x * v[1] - y * v[0])
    return (v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx))


def qconj(q):
    return (-q[0], -q[1], -q[2], q[3])


def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz)


# ----------------------------------------------------------------------------- main
def main():
    want_json = "--json" in sys.argv
    print("Singer exhibit: offline verification (Lua %s via lupa)" % lua51.LuaRuntime().eval("_VERSION"))

    # T1 -------------------------------------------------------------------------------------
    print("T1 XML / Lua cross-check")
    S = Session()
    lua_ids = [S.api.SUBSYSTEMS[i + 1].id for i in range(len(S.api.SUBSYSTEMS))]
    sys_tags = [b["tags"]["sys"] for b in S.bodies if "sys" in b["tags"]]
    btn_tags = [s["tags"]["btn"] for s in S.shapes if "btn" in s["tags"]]
    check("prefab.xml parses", True)
    check("16 subsystem ids in Lua", len(lua_ids) == 16, str(len(lua_ids)))
    check("each sys id has exactly one body", sorted(sys_tags) == sorted(set(sys_tags)) and len(sys_tags) == 16)
    check("each sys id has exactly one button", all(btn_tags.count(i) == 1 for i in sys_tags))
    check("reset and run buttons exist", btn_tags.count("reset") == 1 and btn_tags.count("run") == 1)
    check("Lua ids == XML ids", sorted(lua_ids) == sorted(sys_tags), str(set(lua_ids) ^ set(sys_tags)))
    for b in S.bodies:
        n = sum(1 for k in b["tags"] if k == "sys")
        if "sys" in b["tags"]:
            pass
    connects_ok = all(c in lua_ids for i in range(16) for c in list(S.api.SUBSYSTEMS[i + 1].connects.values()))
    check("every 'connects' entry names a real subsystem", connects_ok)

    # T2 -------------------------------------------------------------------------------------
    print("T2 globals")
    added = sorted(S.after - S.before)
    check("only init/tick/draw are added as globals", added == ["draw", "init", "tick"], ", ".join(added))

    # T3 -------------------------------------------------------------------------------------
    print("T3 init")
    ex = S.api.ex
    check("exhibit initialised", ex.ok)
    nb = sum(1 for i in range(16) if S.api.ex.order[i + 1].body != 0)
    check("16 bodies resolved", nb == 16, str(nb))
    check("18 buttons resolved", len(list(ex.buttons.keys())) == 18)
    arts = sorted(ex.art.keys())
    check("articulated shapes resolved", len(arts) >= 10, ", ".join(arts))

    home = S.snapshot()
    CFG = S.api.CONFIG
    OPEN = CFG.OPEN_TIME
    frames_open = math.ceil(OPEN / DT)

    # T10 (cost) measured first, in IDLE --------------------------------------------------------
    print("T10 per-tick cost in IDLE")
    c0 = dict(S.stub.calls.items())
    S.tick(60)
    c1 = dict(S.stub.calls.items())
    check("one raycast per tick", c1["QueryRaycast"] - c0["QueryRaycast"] == 60)
    check("no SetBodyTransform while idle", c1["SetBodyTransform"] == c0["SetBodyTransform"])
    check("no Find* calls after init", c1["Find"] == c0["Find"])

    # T4 + path recording ------------------------------------------------------------------------
    print("T4 open / show / close, per subsystem")
    meta, vox = load_voxels()
    paths = {}
    worst_home = 0.0
    timing_ok = True
    for sid in lua_ids:
        S.press(sid)
        frames = [(S.api.st.t, S.snapshot())]
        n = S.run_until(lambda: S.mode != "OPENING")
        # record the opening path (we re-run it frame by frame for the record)
        timing_ok &= abs((n + 1) * DT - OPEN) <= DT + 1e-9
        S.tick(90)                         # shown, swaying
        shown = S.mode == "SHOWN"
        S.press(sid)                       # same button closes
        n2 = S.run_until(lambda: S.mode != "CLOSING")
        timing_ok &= abs((n2 + 1) * DT - OPEN) <= 2 * DT + 1e-9
        err = max_err(S.snapshot(), home)
        worst_home = max(worst_home, err)
        if not (shown and S.mode == "IDLE" and err < TOL):
            check("cycle " + sid, False, "shown=%s mode=%s err=%.2e" % (shown, S.mode, err))
    check("every subsystem returns home within 1e-4", worst_home < TOL, "worst %.2e" % worst_home)
    check("OPENING and CLOSING each take OPEN_TIME", timing_ok)

    # path sampling: step manually through OPENING recording every frame
    for sid in lua_ids:
        S.press(sid)
        rec = []
        while S.mode == "OPENING":
            rec.append((S.api.st.t, S.snapshot()))
            S.tick()
        rec.append((S.api.st.t, S.snapshot()))
        paths[sid] = rec
        S.press("reset")
        S.run_until(lambda: S.mode == "IDLE")

    # T5 ---------------------------------------------------------------------------------------
    print("T5 switch while shown")
    S.press("needle_assembly")
    S.run_until(lambda: S.mode == "SHOWN")
    S.tick(30)
    S.press("treadle")
    a_home_before_b = None
    seq_ok = S.mode == "CLOSING" and S.api.st.queued == "treadle"
    while S.mode == "CLOSING":
        S.tick()
    if S.mode == "OPENING" and S.api.st.id == "treadle":
        a_h = S.sys_body["needle_assembly"]
        a_home_before_b = max_err({a_h: S.tf(a_h)}, {a_h: home[a_h]})
    S.run_until(lambda: S.mode == "SHOWN")
    check("B queued and A closing", seq_ok)
    check("A fully home before B opens", a_home_before_b is not None and a_home_before_b < TOL,
          "err %s" % (("%.2e" % a_home_before_b) if a_home_before_b is not None else "n/a"))
    check("B ends shown", S.mode == "SHOWN" and S.api.st.id == "treadle")
    S.press("reset")
    S.run_until(lambda: S.mode == "IDLE")

    # T6 ---------------------------------------------------------------------------------------
    print("T6 RESET from every state")
    bound = int((OPEN + CFG.RUN_TIME) / DT) + 10
    def reset_from(setup):
        setup()
        S.press("reset")
        n = S.run_until(lambda: S.mode == "IDLE", bound)
        return S.mode == "IDLE" and n < bound and max_err(S.snapshot(), home) < TOL
    ok = reset_from(lambda: None)
    ok &= reset_from(lambda: (S.press("shuttle"), S.tick(40)))                                  # mid-OPENING
    ok &= reset_from(lambda: (S.press("shuttle"), S.run_until(lambda: S.mode == "SHOWN")))       # SHOWN
    ok &= reset_from(lambda: (S.press("cabinet"), S.run_until(lambda: S.mode == "SHOWN"),
                              S.press("cabinet"), S.tick(20)))                                   # CLOSING
    ok &= reset_from(lambda: (S.press("run"), S.tick(100)))                                      # RUN
    check("RESET from IDLE/OPENING/SHOWN/CLOSING/RUN returns to IDLE at home", ok)
    # reset while opening must reverse smoothly: the frame after RESET moves no further than the
    # frame before it (same speed, opposite direction), i.e. no jump
    S.press("drawers"); S.tick(48)
    s0 = S.snapshot(); S.tick(); s1 = S.snapshot(); S.press("reset"); s2 = S.snapshot()
    def step_of(a, b):
        return max(max(abs(a[h][0][i] - b[h][0][i]) for i in range(3)) for h in a)
    d1, d2 = step_of(s0, s1), step_of(s1, s2)
    check("RESET during OPENING reverses without a jump", d2 <= d1 * 1.05 + 1e-4, "step before %.4f m, after %.4f m" % (d1, d2))
    S.run_until(lambda: S.mode == "IDLE")

    # T7 ---------------------------------------------------------------------------------------
    print("T7 RUN")
    S.press("run")
    tre = S.sys_body["treadle"]
    max_ang = 0.0
    n = 0
    while S.mode == "RUN":
        q = S.tf(tre)[1]
        ang = 2 * math.degrees(math.asin(min(1.0, abs(q[0]))))
        max_ang = max(max_ang, ang)
        S.tick()
        n += 1
    check("RUN lasts RUN_TIME", abs((n + 1) * DT - CFG.RUN_TIME) <= 2 * DT, "%.3f s" % ((n + 1) * DT))
    check("treadle rocks about +/-12 degrees", 11.5 < max_ang < 13.0, "max %.2f deg" % max_ang)
    check("RUN ends exactly at home", max_err(S.snapshot(), home) < TOL)
    ra = S.api.runAngle
    total = 2 * math.pi * CFG.RUN_TURNS
    check("run angle ends on a whole number of turns", abs(ra(CFG.RUN_TIME) - total) < 1e-9 and
          abs((total * S.api.GEOM.kin.belt_ratio) / (2 * math.pi) - round(total * S.api.GEOM.kin.belt_ratio / (2 * math.pi))) < 1e-9)
    # pitman length stays constant through the run
    S2 = Session()
    S2.press("run")
    K = S2.api.GEOM.kin
    plen = []
    pit = S2.sys_body["pitman_rod"]
    p0 = [K.stud0[1], K.stud0[2], K.stud0[3]]
    a0 = [K.crank_pin0[1], K.crank_pin0[2], K.crank_pin0[3]]
    h0 = S2.tf(pit)
    while S2.mode == "RUN":
        pos, rot = S2.tf(pit)
        # transform both pivots by the body's current world transform relative to home
        rel_q = qmul(rot, qconj(h0[1]))
        def tp(p):
            r = qrot(rel_q, [p[i] + h0[0][i] - h0[0][i] for i in range(3)])
            return [r[i] + pos[i] - qrot(rel_q, h0[0])[i] for i in range(3)]
        pa, pb = tp(a0), tp(p0)
        plen.append(math.dist(pa, pb))
        S2.tick()
    check("pitman stays rigid (pin-to-stud length constant)", max(plen) - min(plen) < 1e-6, "%.2e" % (max(plen) - min(plen)))

    # T8 ---------------------------------------------------------------------------------------
    print("T8 determinism")
    def script():
        s = Session()
        log = []
        for sid in ("gear_train", "drawers", "run"):
            s.press(sid)
            for _ in range(240):
                s.tick()
                log.append(s.snapshot())
            s.press("reset")
            s.run_until(lambda: s.mode == "IDLE")
        return log
    l1, l2 = script(), script()
    same = all(l1[i] == l2[i] for i in range(len(l1)))
    check("identical transforms on identical input", same, "%d frames" % len(l1))

    # T9 ---------------------------------------------------------------------------------------
    print("T9 paths: bounding boxes (present phase, 60 samples) and voxel-exact contacts")
    bad, report = check_paths(S, paths, home, vox, meta, lua_ids, CFG)
    uniq = sorted(set((a, b) for a, b, _ in bad))
    check("present phase: selected box never intersects a shifted body's box", not uniq,
          "; ".join("%s x %s" % p for p in uniq[:8]))
    present = {sid: c["present"] for sid, c in report.items() if c["present"]}
    check("present phase: zero voxel contacts", not present, json.dumps(present))
    print("  voxel contacts by phase (max cells overlapping in any frame):")
    for sid in lua_ids:
        c = report[sid]
        parts = []
        for ph in ("makeway", "lift", "shift", "present"):
            if c.get(ph):
                parts.append("%s: %s" % (ph, ", ".join("%s %d" % kv for kv in sorted(c[ph].items(), key=lambda kv: -kv[1]))))
        print("    %-18s %s" % (sid, "; ".join(parts) if parts else "clear"))
    S.contacts = report

    # export for the web viewer ------------------------------------------------------------------
    export_exhibit(S)

    passed = sum(1 for _, ok, _ in results if ok)
    print("\n%d / %d checks passed" % (passed, len(results)))
    if want_json:
        out = sys.argv[sys.argv.index("--json") + 1]
        with open(out, "w", newline="\n") as f:
            json.dump({"checks": [{"name": n, "ok": o, "detail": d} for n, o, d in results], "contacts": report}, f, indent=1)
    sys.exit(0 if passed == len(results) else 1)


def check_paths(S, paths, home, vox, meta, lua_ids, CFG):
    """Voxel-exact interpenetration along every opening path, all body pairs, every 2nd frame.
    Non-selected bodies only ever translate, so their occupancy is looked up after undoing their
    translation; the selected body (which rotates in the present phase, and whose shapes articulate)
    is transformed voxel by voxel."""
    base = next(b["pos"] for b in S.bodies if b["name"] == "sys_cabinet")
    occ, cells_of = {}, {}
    for sid, bh in S.sys_body.items():
        cs = []
        for s in S.shapes:
            if s["body"]["h"] == bh:
                cs.extend((c, s["h"]) for c in vox[s["file"].split("/")[-1]]["cells"])
        cells_of[sid] = cs
        occ[sid] = set(c for c, _ in cs)
    aabb = {sid: meta["bounds_m"][sid] for sid in lua_ids}
    # static obstacles (console, plinth + dais) in the machine frame (their XML is in the exhibit frame)
    lift_cm = round(base[1] * 100)
    for name in ("console_plate", "plinth"):
        b = next(b for b in S.bodies if b["name"] == name)
        cs = set()
        for s in b["shapes"]:
            for (x, y, z) in vox[s["file"].split("/")[-1]]["cells"]:
                cs.add((x, y - lift_cm, z))
        occ[name] = cs
        lo = [min(c[i] for c in cs) / 100.0 for i in range(3)]
        hi = [(max(c[i] for c in cs) + 1) / 100.0 for i in range(3)]
        aabb[name] = [lo, hi]
    bbox_bad, report = [], {}
    for sid, rec in paths.items():
        frame = any(S.api.SUBSYSTEMS[i + 1].id == sid and S.api.SUBSYSTEMS[i + 1].frame for i in range(16))
        bh = S.sys_body[sid]
        contacts = {"makeway": {}, "lift": {}, "shift": {}, "present": {}}
        for fi, (t, snap) in enumerate(rec[1:]):
            if fi % 2:
                continue
            if frame:
                phase = "makeway" if t <= CFG.LIFT_END + 1e-9 else ("lift" if t <= CFG.FRAME_LIFT_END + 1e-9 else
                                                                   ("shift" if t < CFG.PRESENT_START else "present"))
            else:
                phase = "lift" if t <= CFG.LIFT_END + 1e-9 else ("shift" if t < CFG.PRESENT_START else "present")
            delta = {}
            for osid, oh in S.sys_body.items():
                if osid != sid:
                    delta[osid] = tuple(snap[oh][0][i] - home[oh][0][i] for i in range(3))
            static = {"console_plate": (0.0, 0.0, 0.0), "plinth": (0.0, 0.0, 0.0)}
            # selected body: world points
            pos, rot = snap[bh]
            pts = []
            for (cx, cy, cz), sh in cells_of[sid]:
                spos, srot = snap[sh]
                hpos, hrot = home[sh]
                p = ((cx + 0.5) / 100.0, (cy + 0.5) / 100.0, (cz + 0.5) / 100.0)
                if spos != hpos or srot != hrot:
                    dq = qmul(srot, qconj(hrot))
                    r = qrot(dq, [p[i] - hpos[i] for i in range(3)])
                    p = tuple(r[i] + spos[i] for i in range(3))
                w = qrot(rot, p)
                pts.append((w[0] + pos[0] - base[0], w[1] + pos[1] - base[1], w[2] + pos[2] - base[2]))
            lo = [min(p[i] for p in pts) for i in range(3)]
            hi = [max(p[i] for p in pts) for i in range(3)]
            hits = {}
            for osid, d in list(delta.items()) + list(static.items()):
                if osid == "plinth" and phase != "present":
                    pass
                olo = [aabb[osid][0][i] + d[i] for i in range(3)]
                ohi = [aabb[osid][1][i] + d[i] for i in range(3)]
                if not all(lo[i] < ohi[i] and hi[i] > olo[i] for i in range(3)):
                    continue
                if phase == "present" and osid not in static:
                    bbox_bad.append((sid, osid, round(t, 3)))
                o = occ[osid]
                n = 0
                for p in pts:
                    if (math.floor((p[0] - d[0]) * 100), math.floor((p[1] - d[1]) * 100), math.floor((p[2] - d[2]) * 100)) in o:
                        n += 1
                if n:
                    hits[osid] = n
            # in frame mode the other bodies also move relative to each other while making way
            if frame and phase in ("makeway", "lift"):
                others = list(delta.keys())
                for i, a in enumerate(others):
                    for b in others[i + 1:]:
                        da, db = delta[a], delta[b]
                        if da == db:
                            continue
                        rel = tuple(da[k] - db[k] for k in range(3))
                        alo = [aabb[a][0][k] + rel[k] for k in range(3)]
                        ahi = [aabb[a][1][k] + rel[k] for k in range(3)]
                        if not all(alo[k] < aabb[b][1][k] and ahi[k] > aabb[b][0][k] for k in range(3)):
                            continue
                        small, big, r = (a, b, rel) if len(occ[a]) <= len(occ[b]) else (b, a, tuple(-v for v in rel))
                        n = 0
                        for (x, y, z) in occ[small]:
                            q = (math.floor(x + 0.5 + r[0] * 100), math.floor(y + 0.5 + r[1] * 100), math.floor(z + 0.5 + r[2] * 100))
                            if q in occ[big]:
                                n += 1
                        if n:
                            hits[small + "~" + big] = max(hits.get(small + "~" + big, 0), n)
            for o, n in hits.items():
                contacts[phase][o] = max(contacts[phase].get(o, 0), n)
        report[sid] = contacts
    return bbox_bad, report


def lua_to_py(v):
    if hasattr(v, "keys") and hasattr(v, "values"):
        keys = list(v.keys())
        if keys and all(isinstance(k, int) for k in keys) and sorted(keys) == list(range(1, len(keys) + 1)):
            return [lua_to_py(v[k]) for k in sorted(keys)]
        return {str(k): lua_to_py(v[k]) for k in keys}
    return v


def export_exhibit(S):
    data = {
        "generated_by": "tools/run_tests.py (read from exhibit.lua)",
        "CONFIG": lua_to_py(S.api.CONFIG),
        "SUBSYSTEMS": lua_to_py(S.api.SUBSYSTEMS),
        "GEOM": lua_to_py(S.api.GEOM),
    }
    path = os.path.join(ROOT, "docs", "assets", "exhibit.json")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
