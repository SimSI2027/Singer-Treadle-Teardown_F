#!/usr/bin/env python3
"""
Singer treadle exhibit: the single geometry source.

Every voxel of the exhibit is produced here from a block of real dimensions (centimetres,
machine frame). One run writes:

  vox/*.vox                  MagicaVoxel models, one per shape, 1 voxel = 1 cm (scale 0.1)
  prefab.xml                 the spawnable Teardown prefab (bodies, shapes, tags, anchors)
  exhibit.lua                only the block between "-- BEGIN GENERATED GEOMETRY" and
                             "-- END GENERATED GEOMETRY" (centres, pivots, kinematics)
  docs/assets/geometry.bin   voxels for the web viewer (same data the game loads)
  docs/assets/geometry.json  index for geometry.bin + palette + anchors

Frames (see docs/PLAN.md):
  machine frame : origin on the plinth top under the machine, x = visitor's right,
                  y = up, z = toward the visitor. Units here are cm; exported as metres.
  exhibit frame : origin on the floor. machine frame = exhibit frame + (0, PLINTH_H, 0).

Run:  python tools/generate.py           (fails if any budget is exceeded)
"""
import json
import math
import os
import re
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ----------------------------------------------------------------------------- palette
# Teardown picks a voxel's material from its palette index. Only the two UNBREAKABLE groups are
# used (docs/CONVENTIONS.md section 1): Heavy Metal 169-184 and Rock 185-200.
PALETTE = {
    # name            index  rgb               viewer material
    "iron":          (169, (0x1c, 0x1b, 0x1e), "metal"),   # black japanned cast iron
    "iron_dark":     (170, (0x2a, 0x29, 0x2c), "metal"),
    "iron_mid":      (171, (0x3d, 0x3c, 0x41), "metal"),
    "steel":         (172, (0x8e, 0x93, 0x98), "metal"),
    "steel_bright":  (173, (0xbc, 0xc0, 0xc5), "metal"),
    "nickel":        (174, (0xd6, 0xd8, 0xda), "metal"),
    "brass":         (175, (0xb8, 0x8a, 0x3b), "metal"),
    "brass_bright":  (176, (0xdb, 0xae, 0x57), "metal"),
    "gold":          (177, (0xd8, 0xb5, 0x5c), "metal"),   # decal gold
    "brass_dark":    (178, (0x7a, 0x5a, 0x26), "metal"),
    "bronze":        (179, (0x8c, 0x6b, 0x3b), "metal"),
    "glow":          (180, (0xe8, 0xbb, 0x60), "emit"),    # console button tops (emissive)
    "glow_red":      (181, (0xd2, 0x5a, 0x3c), "emit"),
    "glow_green":    (182, (0x74, 0xb0, 0x5c), "emit"),
    "engrave":       (183, (0x3a, 0x2c, 0x16), "metal"),
    "steel_dark":    (184, (0x55, 0x59, 0x5e), "metal"),
    "oak":           (185, (0xb3, 0x7c, 0x46), "matte"),
    "oak_mid":       (186, (0x95, 0x62, 0x30), "matte"),
    "oak_dark":      (187, (0x6b, 0x42, 0x20), "matte"),
    "walnut":        (188, (0x3e, 0x29, 0x18), "matte"),
    "leather":       (189, (0xa9, 0x73, 0x3d), "matte"),
    "leather_dark":  (190, (0x7d, 0x52, 0x29), "matte"),
    "rubber":        (191, (0x2b, 0x27, 0x25), "matte"),
    "thread":        (192, (0xc0, 0x23, 0x2b), "matte"),
    "felt":          (193, (0x2f, 0x5a, 0x3a), "matte"),
    "spool":         (194, (0xcb, 0x9b, 0x63), "matte"),
    "ivory":         (195, (0xe8, 0xdd, 0xc4), "matte"),
    "floor":         (196, (0x4a, 0x3a, 0x2c), "matte"),
    "bobbin_thread": (197, (0xe9, 0xe3, 0xd3), "matte"),
}
EMISSIVE = [k for k, v in PALETTE.items() if v[2] == "emit"]

PLINTH_H = 8  # cm; the machine group sits on the plinth

# ----------------------------------------------------------------------------- budgets (brief 2.7)
BUDGET = {"bodies": 20, "shapes": 180, "voxels": 250_000, "shapes_per_body": 30}


# ----------------------------------------------------------------------------- shape container
class Shape:
    """A set of 1 cm voxels in a body's frame. Coordinates are integer cell indices (cell i
    spans [i, i+1) cm)."""

    def __init__(self, name, body, priority=50, tags=None):
        self.name = name
        self.body = body
        self.priority = priority
        self.tags = tags or {}
        self.vox = {}

    def set(self, x, y, z, c):
        self.vox[(x, y, z)] = c

    def __len__(self):
        return len(self.vox)


def cells(a, b):
    """Integer cells whose centre lies in [a, b)."""
    return range(math.ceil(a - 0.5 - 1e-9), math.ceil(b - 0.5 - 1e-9))


def box(s, x0, x1, y0, y1, z0, z1, c):
    for x in cells(x0, x1):
        for y in cells(y0, y1):
            for z in cells(z0, z1):
                s.set(x, y, z, c)


def clear_box(s, x0, x1, y0, y1, z0, z1):
    for x in cells(x0, x1):
        for y in cells(y0, y1):
            for z in cells(z0, z1):
                s.vox.pop((x, y, z), None)


def hollow_box(s, x0, x1, y0, y1, z0, z1, c, wall=1):
    box(s, x0, x1, y0, y1, z0, z1, c)
    clear_box(s, x0 + wall, x1 - wall, y0 + wall, y1 - wall, z0 + wall, z1 - wall)


def _axis_split(axis, p):
    """Return (along, a, b) for a point given the axis name."""
    x, y, z = p
    if axis == "x":
        return x, y, z
    if axis == "y":
        return y, x, z
    return z, x, y


def _axis_join(axis, along, a, b):
    if axis == "x":
        return (along, a, b)
    if axis == "y":
        return (a, along, b)
    return (a, b, along)


def cyl(s, axis, ca, cb, r, lo, hi, c, rin=0.0, sector=None):
    """Solid or hollow cylinder. axis 'x': (ca, cb) = (y, z) of the axis; 'y': (x, z); 'z': (x, y).
    sector=(a0, a1) in degrees limits it to a wedge (angle measured in the (a, b) plane)."""
    for t in cells(lo, hi):
        for a in cells(ca - r - 1, ca + r + 1):
            for b in cells(cb - r - 1, cb + r + 1):
                da, db = a + 0.5 - ca, b + 0.5 - cb
                d = math.hypot(da, db)
                if rin - 1e-6 <= d <= r + 1e-6:
                    if sector:
                        ang = math.degrees(math.atan2(db, da)) % 360
                        a0, a1 = sector[0] % 360, sector[1] % 360
                        inside = a0 <= ang <= a1 if a0 <= a1 else (ang >= a0 or ang <= a1)
                        if not inside:
                            continue
                    s.set(*_axis_join(axis, t, a, b), c)


def capsule(s, p0, p1, r, c):
    """All cells whose centre is within r of the segment p0-p1."""
    lo = [min(p0[i], p1[i]) - r - 1 for i in range(3)]
    hi = [max(p0[i], p1[i]) + r + 1 for i in range(3)]
    d = [p1[i] - p0[i] for i in range(3)]
    dd = sum(v * v for v in d) or 1e-9
    for x in cells(lo[0], hi[0]):
        for y in cells(lo[1], hi[1]):
            for z in cells(lo[2], hi[2]):
                q = (x + 0.5, y + 0.5, z + 0.5)
                t = max(0.0, min(1.0, sum((q[i] - p0[i]) * d[i] for i in range(3)) / dd))
                e = [p0[i] + d[i] * t - q[i] for i in range(3)]
                if e[0] * e[0] + e[1] * e[1] + e[2] * e[2] <= r * r + 1e-6:
                    s.set(x, y, z, c)


def line(s, pts, c, step=0.15):
    """A one-voxel polyline (thread, belt): the cells the path passes through."""
    for i in range(len(pts) - 1):
        p0, p1 = pts[i], pts[i + 1]
        n = max(1, int(math.dist(p0, p1) / step))
        for k in range(n + 1):
            t = k / n
            q = [p0[j] + (p1[j] - p0[j]) * t for j in range(3)]
            s.set(math.floor(q[0]), math.floor(q[1]), math.floor(q[2]), c)


def gear(s, axis, ca, cb, r, lo, hi, teeth, c, rin=0.0):
    """Spur gear: root radius r-1, tooth tips at r."""
    for t in cells(lo, hi):
        for a in cells(ca - r - 1, ca + r + 1):
            for b in cells(cb - r - 1, cb + r + 1):
                da, db = a + 0.5 - ca, b + 0.5 - cb
                d = math.hypot(da, db)
                ang = math.atan2(db, da)
                tooth = math.cos(ang * teeth) > 0.0
                rr = r if tooth else r - 1.0
                if rin <= d <= rr + 1e-6:
                    s.set(*_axis_join(axis, t, a, b), c)


def wheel(s, axis, ca, cb, lo, hi, r_out, r_rim, r_hub, spokes, spoke_w, c, curve=0.0, hub_lo=None, hub_hi=None):
    """Cast wheel: rim between r_rim and r_out over [lo, hi), a hub, and `spokes` spokes that may be
    S-curved (curve = tangential bow in cm at mid-radius)."""
    cyl(s, axis, ca, cb, r_out, lo, hi, c, rin=r_rim)
    cyl(s, axis, ca, cb, r_hub, hub_lo if hub_lo is not None else lo, hub_hi if hub_hi is not None else hi, c)
    mid = (lo + hi) / 2
    for k in range(spokes):
        a = 2 * math.pi * k / spokes
        pts = []
        for i in range(9):
            u = i / 8
            rad = r_hub + (r_rim + 0.5 - r_hub) * u
            bow = curve * math.sin(math.pi * u)
            ang = a + bow / max(rad, 1e-6)
            pts.append(_axis_join(axis, mid, ca + rad * math.cos(ang), cb + rad * math.sin(ang)))
        for i in range(len(pts) - 1):
            capsule(s, pts[i], pts[i + 1], spoke_w / 2, c)


# ----------------------------------------------------------------------------- pixel fonts
FONT3 = {  # 3x5, rows top to bottom
    "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
    "2": ["111", "001", "111", "100", "111"], "3": ["111", "001", "111", "001", "111"],
    "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
    "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"],
    "8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "111"],
    "S": ["111", "100", "111", "001", "111"], "I": ["111", "010", "010", "010", "111"],
    "N": ["110", "101", "101", "101", "101"], "G": ["111", "100", "101", "101", "111"],
    "E": ["111", "100", "110", "100", "111"], "R": ["110", "101", "110", "101", "101"],
    "C": ["111", "100", "100", "100", "111"], " ": ["000", "000", "000", "000", "000"],
}
FONT7 = {  # 4x7 (I is 3 wide) for the cast "SINGER" in the treadle side frames
    "S": ["0111", "1000", "1000", "0110", "0001", "0001", "1110"],
    "I": ["111", "010", "010", "010", "010", "010", "111"],
    "N": ["1001", "1101", "1101", "1011", "1011", "1001", "1001"],
    "G": ["0111", "1000", "1000", "1011", "1001", "1001", "0111"],
    "E": ["1111", "1000", "1000", "1110", "1000", "1000", "1111"],
    "R": ["1110", "1001", "1001", "1110", "1010", "1001", "1001"],
}


def text_width(txt, font):
    return sum(len(font[ch][0]) for ch in txt) + len(txt) - 1


def text(s, txt, font, origin, u, v, c):
    """Draw text; origin = cell of the top-left pixel, u = step along the text, v = step down."""
    col = 0
    for ch in txt:
        g = font[ch]
        for row, bits in enumerate(g):
            for k, bit in enumerate(bits):
                if bit == "1":
                    p = [origin[i] + u[i] * (col + k) + v[i] * row for i in range(3)]
                    s.set(*p, c)
        col += len(g[0]) + 1


# ============================================================================= DIMENSIONS (cm)
# Machine frame. Values chosen from period Singer 27/127 treadle outfits (see docs/PLAN.md).
D = {
    "table_y0": 73, "table_y1": 76, "table_x": 45, "table_z": 22,
    "leaf_x0": -65,
    "frame_x": 38,              # inner face of each side frame (frames span 38..40)
    "bed": (-19, 22, 73, 77, -9, 9),
    "needle_x": -14.5, "needle_z": 1.5, "presser_z": -1.5,
    "arm_axis": (100.0, 0.0),   # (y, z) of the arm shaft / handwheel axis
    "band_c": (43.5, -4.5),     # (y, z) of the band wheel axis
    "belt_x": 25,               # cell layer of the belt and both wheel grooves
    "r_belt_band": 14.4,        # belt centre-line radius on the band wheel
    "r_belt_hand": 5.76,        # ... on the handwheel (ratio exactly 2.5)
    "crank_r": 3.1,             # band-wheel crank pin radius
    "crank_phase": -18.0,       # pin angle at home (deg, in the (z, y) plane from +z): treadle swings +/-12 deg
    "treadle_pivot": (9.0, 2.0),
    "stud": (21.5, 11.5, -12.5),  # treadle stud = pitman lower pivot
    "needle_crank_r": 1.6,      # needle-bar crank: stroke 3.2 cm
    "shuttle_pivot": (55.5, 0.0),
}
HAND_C = D["arm_axis"]
BAND_C = D["band_c"]
_ph = math.radians(D["crank_phase"])
CRANK_PIN = (21.5, BAND_C[0] + D["crank_r"] * math.sin(_ph), BAND_C[1] + D["crank_r"] * math.cos(_ph))


def belt_path():
    """Closed belt loop in the (z, y) plane: two external tangents + the two wraps."""
    c1 = (BAND_C[1], BAND_C[0])
    c2 = (HAND_C[1], HAND_C[0])
    r1, r2 = D["r_belt_band"], D["r_belt_hand"]
    dz, dy = c2[0] - c1[0], c2[1] - c1[1]
    dist = math.hypot(dz, dy)
    base = math.atan2(dy, dz)
    alpha = math.acos((r1 - r2) / dist)
    pts = []
    # wrap on the small pulley: base-alpha .. base+alpha (through base, the top)
    n = 48
    for i in range(n + 1):
        a = base - alpha + 2 * alpha * i / n
        pts.append((c2[0] + r2 * math.cos(a), c2[1] + r2 * math.sin(a)))
    # wrap on the band wheel: base+alpha .. base+2pi-alpha (the long way, the bottom)
    for i in range(n * 2 + 1):
        a = base + alpha + (2 * math.pi - 2 * alpha) * i / (n * 2)
        pts.append((c1[0] + r1 * math.cos(a), c1[1] + r1 * math.sin(a)))
    pts.append(pts[0])
    dense = []
    for i in range(len(pts) - 1):                      # densify the two straight strands
        (z0, y0), (z1, y1) = pts[i], pts[i + 1]
        n = max(1, int(math.hypot(z1 - z0, y1 - y0) / 0.5))
        for k in range(n):
            dense.append((z0 + (z1 - z0) * k / n, y0 + (y1 - y0) * k / n))
    dense.append(pts[-1])
    x = D["belt_x"] + 0.5
    return [(x, y, z) for (z, y) in dense]


# ============================================================================= BUILD
SHAPES = []


def S(name, body, priority=50, **tags):
    s = Shape(name, body, priority, tags)
    SHAPES.append(s)
    return s


def build_cabinet():
    top = S("cabinet_top", "cabinet", 40)
    X, Z = D["table_x"], D["table_z"]
    y0, y1 = D["table_y0"], D["table_y1"]
    box(top, -X, X, y0, y1, -Z, Z, "oak")
    box(top, -X, X, y0, y0 + 1, -Z, Z, "oak_mid")                        # underside
    for x0, x1, z0, z1 in ((-X, X, Z - 1, Z), (-X, X, -Z, -Z + 1), (-X, -X + 1, -Z, Z), (X - 1, X, -Z, Z)):
        box(top, x0, x1, y0, y1, z0, z1, "oak_dark")                     # moulded edge
    bx0, bx1, _, _, bz0, bz1 = D["bed"]
    clear_box(top, bx0 - 1, bx1 + 1, y0, y1, bz0 - 1, bz1 + 1)           # opening for the head bed
    # the belt holes are cut later, from the belt itself (see resolve())

    leaf = S("cabinet_leaf", "cabinet", 40)
    box(leaf, D["leaf_x0"], -X, y0, y1, -Z, Z, "oak")
    box(leaf, D["leaf_x0"], D["leaf_x0"] + 1, y0, y1, -Z, Z, "oak_dark")
    for zc in (-14, 13):                                                 # brass leaf hinges
        box(leaf, -X - 3, -X, y0 - 1, y0, zc, zc + 3, "brass")
    box(leaf, D["leaf_x0"] + 4, D["leaf_x0"] + 6, y0 - 6, y0, -1, 1, "iron")   # leaf support bracket

    for side in (-1, 1):
        f = S("cabinet_frame_" + ("L" if side < 0 else "R"), "cabinet", 40)
        fx0, fx1 = (D["frame_x"], D["frame_x"] + 2) if side > 0 else (-D["frame_x"] - 2, -D["frame_x"])
        def fz(y):  # half-depth of the frame silhouette at height y (wide feet, waisted middle)
            if y < 4:
                return 21
            if y < 16:
                return 21 - (y - 4) * 0.35
            if y < 60:
                return 16.8 - (y - 16) * 0.03
            return 15.5 + (y - 60) * 0.3
        for y in range(0, y0):
            hz = fz(y + 0.5)
            for z in cells(-hz, hz):
                zc = z + 0.5
                edge = abs(zc) > hz - 2.2
                band = 18 <= y < 28              # name band
                lattice_zone = 31 <= y < 66
                low_zone = 4 <= y < 15
                solid = edge or y < 3 or y >= y0 - 4 or y in (17, 28, 29, 30)
                if lattice_zone and not solid:
                    # diamond lattice, 6 cm period, 1.3 cm bars
                    u, w = (zc + y) % 6.0, (zc - y) % 6.0
                    solid = u < 1.3 or w < 1.3
                if low_zone and not solid:
                    # a ring medallion around the treadle pivot boss
                    dz, dy = zc - D["treadle_pivot"][1], y + 0.5 - D["treadle_pivot"][0]
                    rr = math.hypot(dz, dy)
                    solid = rr < 2.6 or 4.2 < rr < 5.6 or abs(dy) < 0.6
                if band and not solid:
                    solid = False  # letters added below
                if solid:
                    for x in range(fx0, fx1):
                        f.set(x, y, z, "iron")
        # cast lettering in the band, readable from outside
        w = text_width("SINGER", FONT7)
        if side > 0:   # viewed from +x: text runs toward -z
            text(f, "SINGER", FONT7, (fx0, 26, w // 2), (0, 0, -1), (0, -1, 0), "iron")
            text(f, "SINGER", FONT7, (fx0 + 1, 26, w // 2), (0, 0, -1), (0, -1, 0), "iron")
        else:
            text(f, "SINGER", FONT7, (fx0, 26, -w // 2), (0, 0, 1), (0, -1, 0), "iron")
            text(f, "SINGER", FONT7, (fx0 + 1, 26, -w // 2), (0, 0, 1), (0, -1, 0), "iron")
        # pivot boss (cone) on the inner face for the treadle rod, and casters
        py, pz = D["treadle_pivot"]
        ix = D["frame_x"] - 1 if side > 0 else -D["frame_x"]
        cyl(f, "x", py, pz, 1.6, ix, ix + 1, "iron_mid")
        for zc in (-19, 18):
            box(f, fx0, fx1, -0.0, 1, zc, zc + 2, "iron_dark")
        if side > 0:   # band wheel axle bearing boss
            cyl(f, "x", BAND_C[0], BAND_C[1], 2.2, ix, ix + 1, "iron_mid")
            cyl(f, "x", BAND_C[0], BAND_C[1], 3.0, fx0, fx1, "iron")

    brace = S("cabinet_brace", "cabinet", 40)
    capsule(brace, (-D["frame_x"], 4, -18), (D["frame_x"], 4, -18), 1.0, "iron")
    for x in (-D["frame_x"], D["frame_x"] - 1):
        box(brace, x, x + 1, 2, 6, -20, -16, "iron_mid")


def build_drawers():
    housing = S("drawers_housing", "drawers", 60)
    x0, x1, z0, z1, ytop, ybot = -37, -19, -19, 22, 73, 46
    box(housing, x0, x0 + 1, ybot, ytop, z0, z1, "oak_mid")
    box(housing, x1 - 1, x1, ybot, ytop, z0, z1, "oak_mid")
    box(housing, x0, x1, ybot, ybot + 1, z0, z1, "oak_mid")
    box(housing, x0, x1, ybot, ytop, z0, z0 + 1, "oak_dark")
    for yr in (54, 63):
        box(housing, x0 + 1, x1 - 1, yr, yr + 1, z1 - 2, z1, "oak_dark")      # rails between drawers
    for i, (ya, yb) in enumerate(((64, 72), (55, 63), (47, 54))):
        d = S("drawer_%d" % (i + 1), "drawers", 62, art="drawer_%d" % (i + 1))
        box(d, x0 + 1, x1 - 1, ya, yb, z1 - 2, z1, "oak")                    # front
        box(d, x0 + 1, x1 - 1, ya, ya + 1, z0 + 1, z1, "oak_mid")            # bottom
        box(d, x0 + 1, x0 + 2, ya, yb - 1, z0 + 1, z1, "oak_mid")
        box(d, x1 - 2, x1 - 1, ya, yb - 1, z0 + 1, z1, "oak_mid")
        box(d, x0 + 1, x1 - 1, ya, yb - 1, z0 + 1, z0 + 2, "oak_mid")
        xc, yc = (x0 + x1) // 2, (ya + yb) // 2
        box(d, xc - 1, xc + 1, yc, yc + 1, z1, z1 + 1, "brass")             # brass pull
        box(d, xc - 2, xc + 2, yc, yc + 1, z1 + 1, z1 + 2, "brass_bright")
    front = S("drawer_dropfront", "drawers", 62, art="dropfront")
    box(front, -9, 21, 64, 72, 20, 22, "oak")
    box(front, -9, 21, 64, 65, 20, 22, "oak_dark")
    box(front, 5, 7, 68, 69, 22, 23, "brass")
    box(front, 4, 8, 68, 69, 23, 24, "brass_bright")
    for x in (-9, 20):
        box(housing, x, x + 1, 70, 73, 12, 20, "brass_dark")                # drop-front quadrant stays


def build_head():
    h = S("head_casting", "machine_head", 50)
    bx0, bx1, by0, by1, bz0, bz1 = D["bed"]
    box(h, bx0, bx1, by0, by1, bz0, bz1, "iron")
    # gold pin-stripe border on the bed top and a scroll band on the front edge
    for x in range(bx0 + 1, bx1 - 1):
        for z in (bz0 + 1, bz1 - 2):
            h.set(x, by1 - 1, z, "gold")
    for z in range(bz0 + 1, bz1 - 1):
        for x in (bx0 + 1, bx1 - 2):
            h.set(x, by1 - 1, z, "gold")
    for x in range(bx0, bx1):
        if (x % 4) in (0, 1):
            h.set(x, by0 + 1, bz1 - 1, "gold")
    # needle plate (nickel) and feed-dog slot; slide-plate recess (the slide plate is in the shuttle)
    nx = math.floor(D["needle_x"])
    box(h, nx - 2, nx + 3, by1 - 1, by1, -3, 1, "nickel")
    clear_box(h, -18, -11, by1 - 1, by1, 1, bz1)                             # slide-plate recess (open front)
    clear_box(h, nx, nx + 1, by0, by1, 1, 2)                                 # needle hole through the bed
    # pillar (hollow), tapering
    for y in range(by1, 96):
        k = (y - by1) / (96 - by1)
        xa, za = 13 + round(k), 5 - round(k)
        for x in range(xa, 20):
            for z in range(-za, za):
                if x in (xa, 19) or z in (-za, za - 1):
                    h.set(x, y, z, "iron")
    for y in range(by1, 96, 3):
        h.set(16, y, 4, "gold")                                              # pillar stripe
    # arm: hollow, rounded top, front cut-away window for the arm shaft
    ay0, ay1 = 95, 105
    for x in range(-11, 20):
        for y in range(ay0, ay1):
            for z in range(-4, 4):
                if y == ay1 - 1 and z in (-4, 3):
                    continue                                                 # rounded top edges
                shell = x in (-11, 19) or y in (ay0, ay1 - 1) or z in (-4, 3)
                if shell:
                    h.set(x, y, z, "iron")
    clear_box(h, -10, 20, 98, 102, 3, 4)                                     # front window
    clear_box(h, 19, 20, 98, 102, -2, 4)                                     # bore + slot in pillar wall
    w = text_width("SINGER", FONT3)
    text(h, "SINGER", FONT3, (2 - w // 2, ay1 - 1, -3), (1, 0, 0), (0, 0, 1), "gold")
    for x in range(-9, 18):
        if x % 2 == 0:
            h.set(x, ay1 - 1, 2, "gold")
    # needle-end housing: sectioned front and back (museum cut-away), face plate on the left
    hx0, hx1, hy0, hy1 = -19, -10, 86, 106
    box(h, hx0, hx0 + 1, hy0, hy1, -5, 5, "iron")                           # face plate
    box(h, hx0, hx0 + 1, hy0 + 1, hy1 - 1, -4, 4, "iron_mid")
    box(h, hx1 - 1, hx1, hy0, hy1, -5, 5, "iron")                           # inner wall (joins arm)
    clear_box(h, hx1 - 1, hx1, 96, 104, -3, 3)                               # opening into the arm
    clear_box(h, hx1 - 1, hx1, 98, 102, -3, 5)                               # shaft passes through
    for y0_, y1_ in ((hy0, hy0 + 1), (hy1 - 1, hy1)):                        # bottom plate, top cap
        box(h, hx0, hx1, y0_, y1_, -5, 5, "iron")
        clear_box(h, nx - 1, nx + 2, y0_, y1_, -5, 5)                       # slot for the two bars
    for z in range(-4, 4, 2):
        h.set(hx0 - 0, hy1 - 2, z, "gold")


def build_needle():
    n = S("needle_assembly", "needle_assembly", 90)
    nx, nz = math.floor(D["needle_x"]), math.floor(D["needle_z"])
    box(n, nx, nx + 1, 80, 108, nz, nz + 1, "steel_bright")                 # needle bar
    box(n, nx - 1, nx + 2, 103, 105, nz - 1, nz + 2, "bronze")              # needle-bar bushing
    box(n, nx - 1, nx + 2, 80, 83, nz - 1, nz + 2, "steel")                 # needle clamp
    box(n, nx + 2, nx + 3, 81, 82, nz, nz + 1, "nickel")                    # clamp screw
    box(n, nx, nx + 1, 78, 80, nz, nz + 1, "nickel")                        # needle
    # take-up lever, outside the open housing front (z = 5)
    for x, y in ((-12, 103), (-13, 103), (-14, 104), (-15, 104), (-16, 105), (-17, 105)):
        n.set(x, y, 5, "steel")
        n.set(x, y + 1, 5, "steel")
    for x, y in ((-19, 105), (-18, 105), (-17, 107), (-19, 106), (-19, 107), (-18, 107)):
        n.set(x, y, 5, "steel_bright")                                       # eye ring (hole at -18,106)
    n.set(-11, 103, 5, "bronze")                                             # lever pivot


def build_presser():
    p = S("presser_foot", "presser_foot", 90)
    nx, pz = math.floor(D["needle_x"]), math.floor(D["presser_z"])
    box(p, nx, nx + 1, 79, 108, pz, pz + 1, "steel")                        # presser bar
    box(p, nx - 1, nx + 2, 106, 108, pz - 1, pz + 2, "nickel")              # pressure screw (above cap)
    box(p, nx, nx + 1, 108, 109, pz - 1, pz + 2, "nickel")
    for y in range(96, 103, 2):                                              # coil spring
        for x in range(nx - 1, nx + 2):
            for z in range(pz - 1, pz + 1):
                if (x, z) != (nx, pz):
                    p.set(x, y, z, "steel_bright")
    box(p, nx - 1, nx + 2, 77, 78, -3, 4, "steel_bright")                   # the foot, toes forward
    clear_box(p, nx, nx + 1, 77, 78, 1, 2)                                   # needle slot
    box(p, nx, nx + 1, 78, 79, -3, 0, "steel")                              # shank
    box(p, nx + 1, nx + 2, 89, 90, -8, -5, "steel")                         # lifter lever (behind)
    box(p, nx + 1, nx + 2, 88, 89, -9, -7, "nickel")
    box(p, nx, nx + 1, 89, 90, -5, pz, "steel")


def build_bobbin():
    b = S("bobbin_winder", "bobbin", 80)
    box(b, 16, 22, 77, 78, 6, 9, "iron")                                    # base on the bed
    box(b, 16, 17, 78, 80, 6, 8, "nickel")                                   # winder stop latch
    capsule(b, (20.5, 78, 7.5), (22.5, 80.5, 9.5), 0.8, "iron")             # arm
    cyl(b, "x", 80.5, 10.5, 0.6, 17, 25, "steel_bright")                    # spindle
    cyl(b, "x", 80.5, 10.5, 1.6, 18, 19, "nickel")                          # bobbin flanges
    cyl(b, "x", 80.5, 10.5, 1.6, 21, 22, "nickel")
    cyl(b, "x", 80.5, 10.5, 1.2, 19, 21, "bobbin_thread")                   # wound thread
    cyl(b, "x", 80.5, 10.5, 1.9, 24, 25, "rubber", rin=0.9)                 # rubber tyre, rides the belt
    cyl(b, "x", 80.5, 10.5, 0.9, 24, 25, "steel")


def build_shuttle():
    nx = math.floor(D["needle_x"])
    py, pz = D["shuttle_pivot"]
    race = S("shuttle_race", "shuttle", 80, art="race")
    # curved race: a channel on an arc of radius 15-16.5 about the carrier pivot
    cyl(race, "x", py, pz, 16.5, nx - 2, nx - 1, "steel_dark", rin=12.0, sector=(62, 118))
    cyl(race, "x", py, pz, 16.5, nx + 2, nx + 3, "steel_dark", rin=12.0, sector=(62, 118))
    cyl(race, "x", py, pz, 16.5, nx - 2, nx + 3, "steel_dark", rin=15.6, sector=(62, 118))
    box(race, nx - 3, nx + 4, 70, 73, -10, -8, "iron")                      # race hangers to the bed
    box(race, nx - 3, nx + 4, 70, 73, 8, 10, "iron")
    boat = S("shuttle_boat", "shuttle", 82, art="boat")
    for z in range(-5, 5):                                                  # pointed boat, along z
        half = 1.5 - abs(z + 0.5) * 0.28
        for x in cells(nx + 0.5 - half - 0.2, nx + 0.5 + half + 0.2):
            for y in range(68, 73):
                yy = py + math.sqrt(max(0.0, 14.0 ** 2 - (z + 0.5) ** 2))
                if y + 0.5 <= yy + 1.0 and y + 0.5 >= yy - 2.2:
                    boat.set(x, y, z, "steel_bright")
    box(boat, nx, nx + 1, 70, 71, -2, 2, "bobbin_thread")                   # bobbin inside
    carrier = S("shuttle_carrier", "shuttle", 81, art="boat")
    for zc in (-6, 5):
        box(carrier, nx - 1, nx + 2, 67, 70, zc, zc + 1, "steel")           # carrier jaws
    capsule(carrier, (nx + 2.5, 67.5, -5.5), (nx + 2.5, py + 0.5, pz), 0.8, "steel")
    capsule(carrier, (nx + 2.5, 67.5, 5.5), (nx + 2.5, py + 0.5, pz), 0.8, "steel")
    cyl(carrier, "x", py, pz, 1.2, nx + 1, nx + 5, "iron_mid")              # carrier pivot hub
    slide = S("shuttle_slide", "shuttle", 80, art="slide")
    box(slide, -18, -11, 76, 77, 1, 8, "nickel")
    box(slide, -15, -14, 76, 77, 6, 7, "steel")                             # thumb notch


def build_gear_train():
    nx = math.floor(D["needle_x"])
    dog = S("gear_feed_dog", "gear_train", 80, art="feed_dog")
    box(dog, nx + 1, nx + 2, 71, 73, -2, 1, "steel")                       # feed dog (teeth rise through the plate)
    for z in (-2, 0):
        dog.set(nx + 1, 72, z, "steel_bright")                              # teeth
    box(dog, nx + 1, -1, 70, 72, -1, 0, "steel")                           # feed bar
    rock = S("gear_rock_shaft", "gear_train", 80, art="rock_shaft")
    cyl(rock, "x", 69.0, -5.0, 1.0, -10, 11, "steel")
    for x in (-9, 8):
        box(rock, x, x + 2, 68, 73, -7, -3, "iron_mid")                     # hangers
    capsule(rock, (-1.5, 69, -5), (-1.5, 71, -0.5), 0.6, "steel")          # rock arm to feed bar
    cam = S("gear_cam_shaft", "gear_train", 80, art="cam_shaft")
    cyl(cam, "x", 65.0, 3.0, 0.8, -3, 13, "steel")
    cyl(cam, "x", 65.0, 3.0, 3.0, 0, 2, "steel_bright")                    # feed-lift cam
    cyl(cam, "x", 65.8, 3.6, 2.4, 5, 7, "bronze")                          # eccentric
    bev_a = S("gear_bevel_a", "gear_train", 80, art="bevel_a")
    gear(bev_a, "x", 65.0, 3.0, 3.2, 11, 13, 10, "brass")
    bev_b = S("gear_bevel_b", "gear_train", 80, art="bevel_b")
    gear(bev_b, "y", 15.0, 3.0, 3.0, 68, 70, 10, "brass")
    cyl(bev_b, "y", 15.0, 3.0, 0.7, 70, 73, "steel")


def build_crankshaft():
    c = S("crankshaft", "crankshaft", 85)
    ay, az = HAND_C
    cyl(c, "x", ay, az, 1.0, -13, 20.5, "steel_bright")
    for x0 in (0, 16):
        cyl(c, "x", ay, az, 2.0, x0, x0 + 2, "bronze")                     # bushings
    cyl(c, "x", ay, az, 2.5, -13, -12, "steel")                            # needle-bar crank disc
    cyl(c, "x", ay, az, 2.5, -12, -11, "iron_mid", sector=(180, 360))      # counterweight
    box(c, -14, -13, ay + 1, ay + 2, -1, 0, "steel_bright")                # crank pin
    cyl(c, "x", ay + 0.6, az + 0.4, 1.6, 8, 10, "steel")                   # feed eccentric


def build_drive_wheel():
    w = S("drive_wheel", "drive_wheel", 75)
    ay, az = HAND_C
    wheel(w, "x", ay, az, 24, 27, 6.8, 5.0, 1.8, 5, 1.3, "iron", hub_lo=21, hub_hi=27.5)
    cyl(w, "x", ay, az, 6.8, 24, 25, "nickel", rin=6.0)                    # polished rim edge
    cyl(w, "x", ay, az, 1.3, 27, 27.5, "steel")                            # clutch washer
    cyl(w, "x", ay, az, 1.7, 27.5, 30, "nickel")                           # stop-motion knob
    for k in range(8):
        a = 2 * math.pi * k / 8
        w.set(29, math.floor(ay + 1.6 * math.sin(a)), math.floor(az + 1.6 * math.cos(a)), "steel_bright")


def build_belt_drive():
    wheel_s = S("belt_band_wheel", "belt_drive", 85, art="band_wheel")
    cy, cz = BAND_C
    wheel(wheel_s, "x", cy, cz, 24, 27, 15.4, 13.4, 2.8, 6, 1.5, "iron", curve=2.6, hub_lo=23, hub_hi=28)
    cyl(wheel_s, "x", cy, cz, 1.0, 28, D["frame_x"] - 1, "steel")          # crank axle to the frame boss
    cyl(wheel_s, "x", cy, cz, 4.4, 22, 23, "iron_mid")                     # crank disc
    px = math.floor(CRANK_PIN[0])
    box(wheel_s, 20, 23, math.floor(CRANK_PIN[1]), math.floor(CRANK_PIN[1]) + 1,
        math.floor(CRANK_PIN[2]), math.floor(CRANK_PIN[2]) + 1, "steel_bright")   # crank pin
    cyl(wheel_s, "x", cy, cz, 15.4, 24, 27, "iron_mid", rin=13.4, sector=(240, 300))  # rim counterweight
    belt = S("belt_leather", "belt_drive", 95)
    pts = belt_path()
    line(belt, pts, "leather")
    # leather lace joint and the steel belt hook on the front strand
    for p in pts[::23]:
        belt.set(math.floor(p[0]), math.floor(p[1]), math.floor(p[2]), "leather_dark")
    hook = S("belt_hook_guide", "belt_drive", 90)
    front = [p for p in pts if 62 <= p[1] <= 64 and p[2] > 0]
    if front:
        hx, hy, hz = front[0]
        box(hook, math.floor(hx) - 1, math.floor(hx) + 2, math.floor(hy), math.floor(hy) + 2,
            math.floor(hz) + 1, math.floor(hz) + 2, "steel_bright")
    # belt guide: a bracket under the table with an eyelet around the rear strand
    rear = [p for p in pts if 69 <= p[1] <= 70.5 and p[2] < 0]
    if rear:
        gx, gy, gz = rear[0]
        gy_, gz_ = math.floor(gy), math.floor(gz)
        box(hook, 27, 30, 71, 73, gz_ - 2, gz_ + 3, "iron")
        for dy, dz in ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)):
            hook.set(26, gy_ + dy, gz_ + dz, "nickel")
        box(hook, 26, 27, gy_ + 2, 73, gz_ - 1, gz_ + 2, "iron")


def build_treadle():
    t = S("treadle", "treadle", 70)
    py, pz = D["treadle_pivot"]
    for x in range(-20, 20):
        for z in range(-13, 17):
            xc, zc = x + 0.5, z + 0.5
            border = x in (-20, -19, 18, 19) or z in (-13, -12, 15, 16)
            u, w = (xc + zc) % 5.0, (xc - zc) % 5.0
            lattice = u < 1.2 or w < 1.2
            rib = abs(zc - pz) < 1.2
            if border or lattice or rib:
                for y in range(8, 10):
                    t.set(x, y, z, "iron")
    cyl(t, "x", py, pz, 1.0, -D["frame_x"] + 1, D["frame_x"] - 1, "iron_mid")   # pivot rod
    cyl(t, "x", py, pz, 0.7, -D["frame_x"], -D["frame_x"] + 1, "steel")         # pivot points
    cyl(t, "x", py, pz, 0.7, D["frame_x"] - 1, D["frame_x"], "steel")
    box(t, 18, 24, 8, 10, -14, -11, "iron")                                # rear lug
    sx, sy, sz = D["stud"]
    box(t, math.floor(sx), math.floor(sx) + 1, 10, 13, math.floor(sz), math.floor(sz) + 1, "steel_bright")
    for x in range(-14, 14, 4):                                            # toe ridges
        box(t, x, x + 2, 10, 11, 9, 14, "iron_mid")


def build_pitman():
    p = S("pitman_rod", "pitman", 70)
    a = CRANK_PIN
    b = D["stud"]
    va = (a[1] - b[1], a[2] - b[2])
    ln = math.hypot(*va)
    u = (va[0] / ln, va[1] / ln)
    a_in = (21.5, a[1] - u[0] * 2.4, a[2] - u[1] * 2.4)
    b_in = (21.5, b[1] + u[0] * 2.4, b[2] + u[1] * 2.4)
    capsule(p, b_in, a_in, 0.95, "oak_mid")                                  # wooden rod
    for c in (a, b):                                                          # brass ball-and-socket ends
        cyl(p, "x", c[1] - 0.0, c[2] - 0.0, 1.9, 20, 23, "brass")
    for c, other in ((a, b_in), (b, a_in)):
        capsule(p, (21.5, c[1], c[2]), other, 1.25, "brass")
        capsule(p, (21.5, c[1], c[2]), (21.5, c[1] + (other[1] - c[1]) * 0.25, c[2] + (other[2] - c[2]) * 0.25), 1.3, "brass_bright")


def build_tension():
    t = S("tension_regulator", "tension_regulator", 80)
    cy, cz = 96.0, 0.0
    box(t, -20, -19, 93, 99, -2, 2, "nickel")                               # bracket on the face plate
    cyl(t, "x", cy, cz, 0.6, -27, -19, "steel")                            # stud
    cyl(t, "x", cy, cz, 2.0, -21, -20, "nickel")                           # disc A
    cyl(t, "x", cy, cz, 2.0, -23, -22, "nickel")                           # disc B (thread runs between)
    for x in (-24, -23):
        cyl(t, "x", cy, cz, 1.2, x, x + 1, "steel_bright", rin=0.8)        # spring
    cyl(t, "x", cy, cz, 1.6, -27, -25, "nickel")                           # thumb nut
    for k in range(10):
        a = 2 * math.pi * k / 10
        t.set(-26, math.floor(cy + 1.6 * math.sin(a)), math.floor(cz + 1.6 * math.cos(a)), "steel")
    for y, z in ((92, 2), (93, 2), (94, 2), (92, 3)):                       # check spring
        t.set(-20, y, z, "steel_bright")


def build_spool():
    s = S("spool_pin", "spool_pin", 80)
    cx, cz = 4.0, 0.0
    cyl(s, "y", cx, cz, 0.5, 105, 114, "steel_bright")                     # pin
    cyl(s, "y", cx, cz, 2.6, 105, 106, "felt")                             # felt pad
    cyl(s, "y", cx, cz, 2.6, 106, 107, "spool", rin=0.6)                   # spool ends
    cyl(s, "y", cx, cz, 2.6, 111, 112, "spool", rin=0.6)
    cyl(s, "y", cx, cz, 2.0, 107, 111, "thread", rin=0.6)                  # thread on the spool


def build_thread_path():
    g = S("thread_guides", "thread_guide_path", 92)
    th = S("thread_line", "thread_guide_path", 100)
    nx, nz = D["needle_x"], D["needle_z"]
    # guide eyelets (nickel): arm top, face plate top, face plate front, needle clamp
    for (x, y, z) in ((-4, 106, 3), (-20, 103, 1)):
        for dy, dz in ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)):
            g.set(x, y + dy, z + dz, "nickel")
    box(g, -4, -3, 105, 106, 3, 5, "nickel")
    for dx, dy in ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)):
        g.set(-19 + dx, 88 + dy, 6, "nickel")                              # lower guide on the face plate
    box(g, -20, -19, 87, 90, 5, 6, "nickel")
    g.set(-14, 84, 3, "nickel")                                            # needle-bar thread guide
    g.set(-16, 84, 3, "nickel")
    pts = [
        (4.5, 109.5, 3.2),        # leaves the spool toward the visitor
        (3.0, 108.0, 4.0),
        (-3.5, 106.5, 3.5),       # through the arm-top eyelet
        (-12.0, 106.5, 2.5),
        (-19.5, 103.5, 1.5),      # face-plate guide eyelet
        (-21.5, 101.0, 1.0),
        (-21.5, 93.5, -0.5),      # between the tension discs, under the stud
        (-21.5, 93.0, 2.5),
        (-20.5, 92.0, 3.5),       # check spring
        (-18.5, 106.5, 4.0),
        (-17.5, 106.5, 5.5),      # take-up lever eye (hole at -18,106,5)
        (-17.5, 106.5, 6.5),
        (-18.5, 88.5, 6.5),       # lower guide
        (-15.5, 84.5, 3.5),       # needle-bar guide
        (nx, 79.5, 3.5),
        (nx, 79.5, nz),           # needle eye
        (nx, 79.5, -0.5),
        (nx - 0.5, 78.4, -2.5),   # tail under the presser foot
    ]
    line(th, pts, "thread")


def build_console():
    """Brass lectern console: 4x4 subsystem buttons + RESET + RUN. Exhibit frame (cm)."""
    plate = S("console_plate", "console_plate", 50)
    X0, X1, Z0, Z1 = 56, 115, 133, 170
    # column + foot
    box(plate, 80, 90, 0, 86, 145, 155, "iron")
    box(plate, 74, 96, 0, 3, 139, 161, "iron")
    box(plate, 76, 94, 3, 5, 141, 159, "iron_mid")
    # stepped brass plate: four tiers, the back tier highest (reads like a tilted lectern)
    for r in range(4):
        za, zb = Z0 + 9 * r, Z0 + 9 * (r + 1)
        top = 94 + (3 - r)
        box(plate, X0, X1, 86, top, za, zb, "brass")
    box(plate, X0, X1, 86, 94, Z1 - 3, Z1, "brass")
    box(plate, X0, X1, 86, 87, Z0, Z1, "brass_dark")
    # ivory title placard on the front apron
    box(plate, 66, 105, 87, 93, Z1, Z1 + 1, "ivory")
    w = text_width("SINGER", FONT3)
    text(plate, "SINGER", FONT3, (85 - w // 2, 92, Z1), (1, 0, 0), (0, -1, 0), "engrave")
    buttons = []
    ids = SUBSYSTEM_IDS
    for i, sid in enumerate(ids):
        r, c = divmod(i, 4)
        x0, z0 = X0 + 2 + c * 10, Z0 + 1 + r * 9
        tier = 94 + (3 - r)
        b = S("btn_" + sid, "console_plate", 60, btn=sid)
        box(b, x0, x0 + 8, tier, tier + 2, z0, z0 + 7, "glow")
        num = str(i + 1)
        wn = text_width(num, FONT3)
        text(b, num, FONT3, (x0 + 4 - (wn + 1) // 2, tier + 1, z0 + 1), (1, 0, 0), (0, 0, 1), "engrave")
        box(plate, x0 + 1, x0 + 7, tier - 1, tier, z0 + 7, z0 + 8, "engrave")    # engraved label strip
        clear_box(plate, x0, x0 + 8, tier - 1, tier, z0, z0 + 7)
        buttons.append(b)
    for sid, colr, z0, glyph in (("reset", "glow_red", Z0 + 1, "R"), ("run", "glow_green", Z0 + 19, None)):
        b = S("btn_" + sid, "console_plate", 60, btn=sid)
        x0 = X0 + 43
        box(b, x0, x0 + 13, 97, 100, z0, z0 + 16, colr)
        if glyph:
            text(b, "R", FONT3, (x0 + 5, 99, z0 + 5), (1, 0, 0), (0, 0, 1), "engrave")
            text(b, "R", FONT3, (x0 + 5, 99, z0 + 6), (1, 0, 0), (0, 0, 1), "engrave")
        else:
            for k in range(5):                                             # play triangle
                for zz in range(k, 9 - k):
                    b.set(x0 + 4 + k, 99, z0 + 4 + zz, "engrave")
        box(plate, x0, x0 + 13, 94, 97, z0, z0 + 16, "brass_dark")         # raised boss
    return buttons


def build_plinth():
    p = S("plinth_base", "plinth", 30)
    X0, X1, Z0, Z1 = -165, 60, -45, 40
    hollow_box(p, X0, X1, 0, PLINTH_H, Z0, Z1, "walnut")                 # hollow: only the skin is drawn
    clear_box(p, X0 + 1, X1 - 1, 0, 1, Z0 + 1, Z1 - 1)                     # (no bottom face needed)
    box(p, X0, X1, PLINTH_H - 1, PLINTH_H, Z0, Z1, "floor")
    for x0, x1, z0, z1 in ((X0, X1, Z1 - 1, Z1), (X0, X1, Z0, Z0 + 1), (X0, X0 + 1, Z0, Z1), (X1 - 1, X1, Z0, Z1)):
        box(p, x0, x1, PLINTH_H - 1, PLINTH_H, z0, z1, "brass")
    # an inlaid brass track showing where the machine slides to
    for x in range(-90, 1, 3):
        p.set(x, PLINTH_H - 1, 30, "brass_dark")
    dais = S("display_dais", "plinth", 30)
    cyl(dais, "y", 0.0, 130.0, 30, 0, 6, "walnut", rin=29)
    cyl(dais, "y", 0.0, 130.0, 30, 5, 6, "walnut")
    cyl(dais, "y", 0.0, 130.0, 30, 5, 6, "brass", rin=28.5)
    cyl(dais, "y", 0.0, 130.0, 4, 5, 6, "brass")


# ----------------------------------------------------------------------------- subsystem ids
SUBSYSTEM_IDS = [
    "needle_assembly", "presser_foot", "bobbin", "shuttle", "drive_wheel", "belt_drive",
    "treadle", "pitman_rod", "crankshaft", "gear_train", "tension_regulator", "spool_pin",
    "thread_guide_path", "machine_head", "cabinet", "drawers",
]
BODY_OF_ID = {sid: sid for sid in SUBSYSTEM_IDS}
BODY_OF_ID["pitman_rod"] = "pitman"   # body name; tag id stays pitman_rod


def body_id(body):
    """Body name -> subsystem id (or None for console/plinth)."""
    for sid, b in BODY_OF_ID.items():
        if b == body:
            return sid
    return None


# ============================================================================= RESOLVE + EXPORT
def resolve():
    """Make every cell belong to one shape (higher priority wins) and cut the belt holes."""
    belt = next(s for s in SHAPES if s.name == "belt_leather")
    top = next(s for s in SHAPES if s.name == "cabinet_top")
    for (x, y, z) in belt.vox:                                   # belt holes: dilate by 1 cm
        if D["table_y0"] - 1 <= y <= D["table_y1"]:
            for dx in (-1, 0, 1):
                for dz in (-2, -1, 0, 1, 2):
                    top.vox.pop((x + dx, y, z + dz), None)
    machine = [s for s in SHAPES if s.body not in ("console_plate", "plinth")]
    owner = {}
    lost = {}
    for s in sorted(machine, key=lambda s: -s.priority):
        for cell in list(s.vox):
            if cell in owner and owner[cell].body != s.body:
                del s.vox[cell]
                key = (owner[cell].name, s.name)
                lost[key] = lost.get(key, 0) + 1
            elif cell in owner:
                pass
            else:
                owner[cell] = s
    return lost


def even_grid(s):
    """Grid bounds padded so the grid is symmetric about its pos in x and z (pivot-robust, see
    CONVENTIONS section 12) and has even x/z sizes."""
    xs = [c[0] for c in s.vox]; ys = [c[1] for c in s.vox]; zs = [c[2] for c in s.vox]
    x0, x1, y0, y1, z0, z1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1, min(zs), max(zs) + 1
    if (x1 - x0) % 2:
        x1 += 1
    if (z1 - z0) % 2:
        z1 += 1
    return x0, x1, y0, y1, z0, z1


def write_vox(path, s, grid):
    """MagicaVoxel .vox (version 150): SIZE, XYZI, RGBA, MATL. TD (x, y, z) -> MV (x, nz-1-z, y)."""
    x0, x1, y0, y1, z0, z1 = grid
    nx, ny, nz = x1 - x0, y1 - y0, z1 - z0
    if max(nx, ny, nz) > 256:
        raise SystemExit("shape %s exceeds 256 voxels on an axis" % s.name)
    xyzi = bytearray()
    for (x, y, z), c in s.vox.items():
        xyzi += struct.pack("<BBBB", x - x0, (nz - 1) - (z - z0), y - y0, PALETTE[c][0])

    def chunk(cid, content, children=b""):
        return cid.encode() + struct.pack("<ii", len(content), len(children)) + content + children

    size = chunk("SIZE", struct.pack("<iii", nx, nz, ny))
    xyzi_c = chunk("XYZI", struct.pack("<i", len(s.vox)) + bytes(xyzi))
    rgba = bytearray()
    by_index = {v[0]: v[1] for v in PALETTE.values()}
    for i in range(1, 257):
        r, g, b = by_index.get(i, (0x80, 0x80, 0x80))
        rgba += bytes((r, g, b, 255))
    rgba_c = chunk("RGBA", bytes(rgba))

    def dict_bytes(d):
        out = struct.pack("<i", len(d))
        for k, v in d.items():
            out += struct.pack("<i", len(k)) + k.encode() + struct.pack("<i", len(v)) + v.encode()
        return out

    matl = b""
    for name in EMISSIVE:
        idx = PALETTE[name][0]
        matl += chunk("MATL", struct.pack("<i", idx) + dict_bytes({"_type": "_emit", "_emit": "1.0", "_flux": "1"}))
    for name, (idx, _, kind) in PALETTE.items():
        if kind == "metal":
            matl += chunk("MATL", struct.pack("<i", idx) + dict_bytes({"_type": "_metal", "_rough": "0.35", "_metal": "0.8"}))
    main = chunk("MAIN", b"", size + xyzi_c + rgba_c + matl)
    with open(path, "wb") as f:
        f.write(b"VOX " + struct.pack("<i", 150) + main)


def fmt(v):
    s = ("%.4f" % v).rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def main():
    build_cabinet(); build_drawers(); build_head(); build_needle(); build_presser(); build_bobbin()
    build_shuttle(); build_gear_train(); build_crankshaft(); build_drive_wheel(); build_belt_drive()
    build_treadle(); build_pitman(); build_tension(); build_spool(); build_thread_path()
    build_console(); build_plinth()
    lost = resolve()

    os.makedirs(os.path.join(ROOT, "vox"), exist_ok=True)
    for f in os.listdir(os.path.join(ROOT, "vox")):
        if f.endswith(".vox"):
            os.remove(os.path.join(ROOT, "vox", f))

    bodies = {}
    for s in SHAPES:
        if not s.vox:
            raise SystemExit("empty shape " + s.name)
        bodies.setdefault(s.body, []).append(s)

    # ---- budgets
    nvox = sum(len(s) for s in SHAPES)
    report = {
        "bodies": len(bodies), "shapes": len(SHAPES), "voxels": nvox,
        "shapes_per_body": max(len(v) for v in bodies.values()),
    }
    fails = [k for k in BUDGET if report[k] > BUDGET[k]]

    # ---- per-shape export
    shape_meta = []
    blob = bytearray()
    for s in SHAPES:
        grid = even_grid(s)
        x0, x1, y0, y1, z0, z1 = grid
        fname = s.name + ".vox"
        write_vox(os.path.join(ROOT, "vox", fname), s, grid)
        pos = ((x0 + x1) / 2, y0, (z0 + z1) / 2)
        off = len(blob)
        for (x, y, z), c in s.vox.items():
            blob += struct.pack("<BBBB", x - x0, y - y0, z - z0, PALETTE[c][0])
        shape_meta.append({
            "name": s.name, "body": s.body, "file": fname, "tags": s.tags,
            "pos_cm": pos, "origin_cm": (x0, y0, z0), "size": (x1 - x0, y1 - y0, z1 - z0),
            "offset": off, "count": len(s.vox),
        })
        s.grid, s.pos = grid, pos

    # ---- centres and bounds per subsystem body (machine frame, metres)
    centers, bounds = {}, {}
    for body, shapes in bodies.items():
        sid = body_id(body)
        if not sid:
            continue
        allc = [c for s in shapes for c in s.vox]
        lo = [min(c[i] for c in allc) for i in range(3)]
        hi = [max(c[i] for c in allc) + 1 for i in range(3)]
        centers[sid] = [(lo[i] + hi[i]) / 200.0 for i in range(3)]
        bounds[sid] = [[v / 100.0 for v in lo], [v / 100.0 for v in hi]]

    write_prefab(bodies)
    write_lua_block(centers, bounds)
    write_viewer(shape_meta, blob, centers, bounds)

    print("budget:", json.dumps(report), "limits:", json.dumps(BUDGET))
    if "-v" in sys.argv:
        for s in sorted(SHAPES, key=lambda s: -len(s)):
            print("  %-24s %-18s %6d voxels  grid %s" % (s.name, s.body, len(s), "x".join(str(v) for v in (s.grid[1]-s.grid[0], s.grid[3]-s.grid[2], s.grid[5]-s.grid[4]))))
    for (a, b), n in sorted(lost.items(), key=lambda kv: -kv[1])[:12]:
        print("  resolved overlap: %-22s kept %4d cells over %s" % (a, n, b))
    if fails:
        raise SystemExit("BUDGET EXCEEDED: " + ", ".join(fails))


def tag_str(d):
    return " ".join(("%s=%s" % (k, v)) if v is not None else k for k, v in d.items())


def write_prefab(bodies):
    P = PLINTH_H / 100.0
    L = []
    w = L.append
    w('<prefab version="1.4.0">')
    w('<!-- GENERATED by tools/generate.py. Do not edit by hand: edit the generator and re-run. -->')
    w('<group name="singer_exhibit" tags="exhibit" pos="0 0 0">')
    w('  <script file="MOD/exhibit.lua">')
    w('    <group name="machine" pos="0 %s 0">' % fmt(P))
    w('      <location name="machine_origin" tags="anchor=machine" pos="0 0 0"/>')
    for sid in SUBSYSTEM_IDS:
        body = BODY_OF_ID[sid]
        w('      <body name="sys_%s" tags="sys=%s" pos="0 0 0" dynamic="false">' % (body, sid))
        for s in bodies[body]:
            t = (' tags="%s"' % tag_str(s.tags)) if s.tags else ""
            w('        <vox file="MOD/vox/%s.vox" pos="%s %s %s" scale="0.1"%s/>'
              % (s.name, fmt(s.pos[0] / 100), fmt(s.pos[1] / 100), fmt(s.pos[2] / 100), t))
        w('      </body>')
    w('    </group>')
    w('    <group name="console" pos="0 0 0">')
    w('      <body name="console_plate" tags="console" pos="0 0 0" dynamic="false">')
    for s in bodies["console_plate"]:
        t = (' tags="%s"' % tag_str(s.tags)) if s.tags else ""
        w('        <vox file="MOD/vox/%s.vox" pos="%s %s %s" scale="0.1"%s/>'
          % (s.name, fmt(s.pos[0] / 100), fmt(s.pos[1] / 100), fmt(s.pos[2] / 100), t))
    w('      </body>')
    w('    </group>')
    w('    <group name="display" pos="0 0 0">')
    w('      <location name="display_point" tags="anchor=display" pos="0 1.1 1.3"/>')
    w('      <location name="shift_point" tags="anchor=shift" pos="-0.9 %s 0"/>' % fmt(P))
    w('      <body name="plinth" tags="plinth" pos="0 0 0" dynamic="false">')
    for s in bodies["plinth"]:
        w('        <vox file="MOD/vox/%s.vox" pos="%s %s %s" scale="0.1"/>'
          % (s.name, fmt(s.pos[0] / 100), fmt(s.pos[1] / 100), fmt(s.pos[2] / 100)))
    w('      </body>')
    w('      <light name="display_lamp" pos="0 2.2 1.3" type="sphere" color="1 0.84 0.64" scale="4" size="0.08"/>')
    w('      <light name="console_lamp" pos="0.85 1.7 1.45" type="sphere" color="1 0.84 0.64" scale="2" size="0.06"/>')
    w('    </group>')
    w('  </script>')
    w('</group>')
    w('</prefab>')
    with open(os.path.join(ROOT, "prefab.xml"), "w", newline="\n") as f:
        f.write("\n".join(L) + "\n")


def lua_vec(v):
    return "{%s}" % ", ".join(fmt(x) for x in v)


def write_lua_block(centers, bounds):
    path = os.path.join(ROOT, "exhibit.lua")
    with open(path, encoding="utf-8") as f:
        src = f.read()
    m = 0.01
    stud = D["stud"]
    pin = CRANK_PIN
    pivot = D["treadle_pivot"]
    pit_len = math.hypot(pin[1] - stud[1], pin[2] - stud[2])
    rs = math.hypot(stud[1] - pivot[0], stud[2] - pivot[1])
    lines = ["-- BEGIN GENERATED GEOMETRY (tools/generate.py; do not edit by hand)",
             "-- Machine frame, metres: x = visitor's right, y = up, z = toward the visitor.",
             "local GEOM = {", "\tcenter = {"]
    for sid in SUBSYSTEM_IDS:
        lines.append("\t\t%s = %s," % (sid, lua_vec(centers[sid])))
    lines.append("\t},")
    lines.append("\tbounds = {")
    for sid in SUBSYSTEM_IDS:
        lines.append("\t\t%s = {%s, %s}," % (sid, lua_vec(bounds[sid][0]), lua_vec(bounds[sid][1])))
    lines.append("\t},")
    kin = {
        "band_axis": (0, BAND_C[0] * m, BAND_C[1] * m),
        "hand_axis": (0, HAND_C[0] * m, HAND_C[1] * m),
        "treadle_pivot": (0, pivot[0] * m, pivot[1] * m),
        "shuttle_pivot": (0, D["shuttle_pivot"][0] * m, D["shuttle_pivot"][1] * m),
        "crank_pin0": (pin[0] * m, pin[1] * m, pin[2] * m),
        "stud0": (stud[0] * m, stud[1] * m, stud[2] * m),
        "feed_dog": (0, 0.76, 0),
    }
    lines.append("\tkin = {")
    for k, v in kin.items():
        lines.append("\t\t%s = %s," % (k, lua_vec(v)))
    lines.append("\t\tcrank_r = %s," % fmt(D["crank_r"] * m))
    lines.append("\t\tcrank_phase = %s, -- radians" % fmt(math.radians(D["crank_phase"])))
    lines.append("\t\tpitman_len = %s," % fmt(pit_len * m))
    lines.append("\t\tstud_r = %s," % fmt(rs * m))
    lines.append("\t\tbelt_ratio = %s, -- band-wheel groove radius / handwheel groove radius" % fmt(D["r_belt_band"] / D["r_belt_hand"]))
    lines.append("\t\tneedle_crank_r = %s," % fmt(D["needle_crank_r"] * m))
    lines.append("\t},")
    lines.append("}")
    lines.append("-- END GENERATED GEOMETRY")
    block = "\n".join(lines)
    new, n = re.subn(r"-- BEGIN GENERATED GEOMETRY.*?-- END GENERATED GEOMETRY", lambda _: block, src, flags=re.S)
    if n != 1:
        raise SystemExit("exhibit.lua: generated-geometry markers not found")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(new)


def write_viewer(shape_meta, blob, centers, bounds):
    out = os.path.join(ROOT, "docs", "assets")
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "geometry.bin"), "wb") as f:
        f.write(bytes(blob))
    pal = {str(v[0]): {"name": k, "rgb": "#%02x%02x%02x" % v[1], "kind": v[2]} for k, v in PALETTE.items()}
    meta = {
        "generated_by": "tools/generate.py",
        "units": "cm cells; positions in machine frame except console_plate/plinth (exhibit frame)",
        "plinth_h_cm": PLINTH_H,
        "palette": pal,
        "shapes": shape_meta,
        "centers_m": centers,
        "bounds_m": bounds,
        "subsystems": SUBSYSTEM_IDS,
        "body_of_id": BODY_OF_ID,
    }
    with open(os.path.join(out, "geometry.json"), "w", newline="\n") as f:
        json.dump(meta, f, separators=(",", ":"))


if __name__ == "__main__":
    main()
