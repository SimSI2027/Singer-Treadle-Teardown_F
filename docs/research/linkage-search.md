# Treadle linkage: the geometry search

The treadle is a four-bar linkage in the (y, z) plane: ground P→H (pivot to band-wheel hub), crank rc (pin on the hub),
coupler b (the pitman's planar length), rocker lb (pivot to the pitman joint). Every joint axis is parallel to x, so the
3-D pitman length is sqrt(b² + Δx²) with Δx = 0.02 m, and the solve is two circle intersections (`kin.js` `fourBar`).

Constraints used in the search:

- the pitman joint B lies behind the treadle pivot (B_z < P_z), and the foot pad F lies in front (F_z < 0.20 m);
- the rocking swing about its mean is 24° (±12°);
- the mean tilt is near horizontal (|mean| < 1.5°);
- the pitman length is near 0.30 m.

Result (kept in `kin.js`): pivot (y 0.05, z −0.02), rocker lb 0.26 m, foot lf 0.22 m, coupler b 0.32 m, hub (y 0.34, z −0.14),
crank rc 0.05 m, branch −1. Measured over one drive turn: swing 24.5° (−12.9° … +11.6° about the mean), pitman 0.3206 m,
no unreachable crank angles.

A first attempt put the pitman joint in front of the pivot; the foot pad then ended up behind the operator's reach, so the
search required B behind P and F in front. Two search branches jumped by 360° at the atan2 seam; those candidates were
discarded (any span above 90° is a wrap, not a swing).
