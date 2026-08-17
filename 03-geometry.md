# 03 — Geometry

This is the part that must be exactly right. Everything here lives in `src/core/` and is covered
by tests. Read this fully before touching any of it.

## Coordinate frame — ISO 8855, right-handed

- **+X** forward, **+Y** vehicle-left, **+Z** up.
- Origin on the ground plane, at the centre of the vehicle footprint.
- All lengths in metres, all angles in degrees at the API boundary, radians internally.

Sensor local frame: optical axis **+X_c**, **+Y_c** image-left, **+Z_c** image-up.

## Rotation

```
R = Rz(yaw) · Ry(−pitch) · Rx(roll)
```

so **yaw + turns left**, **pitch + tilts up**, **roll + is clockwise about the optical axis**.

With `a = yaw`, `b = −pitch`, `c = roll` in radians:

```
R = ⎡ cos a cos b   cos a sin b sin c − sin a cos c   cos a sin b cos c + sin a sin c ⎤
    ⎢ sin a cos b   sin a sin b sin c + cos a cos c   sin a sin b cos c − cos a sin c ⎥
    ⎣    −sin b                cos b sin c                       cos b cos c          ⎦
```

```ts
export function rotationMatrix(yawDeg: number, pitchDeg: number, rollDeg: number): Mat3 {
  const a = yawDeg * DEG, b = -pitchDeg * DEG, c = rollDeg * DEG;
  const ca = Math.cos(a), sa = Math.sin(a);
  const cb = Math.cos(b), sb = Math.sin(b);
  const cc = Math.cos(c), sc = Math.sin(c);
  return [
    [ca * cb, ca * sb * sc - sa * cc, ca * sb * cc + sa * sc],
    [sa * cb, sa * sb * sc + ca * cc, sa * sb * cc - ca * sc],
    [-sb,     cb * sc,                cb * cc],
  ];
}
```

## FOV volume

A **rectangular cone** whose far surface is one of two things, chosen by `Layout.rangeMode`:

| mode | far surface | `range` means |
|---|---|---|
| `axis` | a flat plane at `range` along the optical axis | distance along the boresight |
| `radial` | a spherical cap of radius `range` | distance in **every** direction |

`axis` is the original model and stays exactly as specified below. It has one consequence worth
stating: the corners reach `range · √(1 + tan²(h/2) + tan²(v/2))`, which for a 150°×20° radar at
80 m is **309 m**. Every number the tool derives — footprint, blind gap, coverage percentage —
counts that overshoot as coverage.

`radial` sweeps the same directions but normalises them to `range`, so the corners stop where the
datasheet says and the footprint reads as a fan. **The lateral faces are identical in both modes**
— fixing `u = ±1` still spans a plane — which is why every acceptance test about the near edge
holds unchanged.

### Fields of 180° and wider

The rectangular cone above is the set of directions a flat image rectangle subtends, and it is
only defined below 180°: its half-width is `tan(hfov/2)`. That is not an arithmetic inconvenience
to be clamped away. No flat rectangle subtends a reflex angle, so a 190° fisheye is not a
rectangular cone that has been cut short, it is a different shape.

At 180° and above the directions are therefore swept by angle. With azimuth `α` over
`[−hfov/2, +hfov/2]` and elevation `β` over `[−vfov/2, +vfov/2]`:

```
d = ( cos β · cos α,  cos β · sin α,  sin β )
```

No tangent, so every angle up to a full turn is expressible, and the quoted figure is what gets
drawn. Fixing `α` still spans a plane, so the sides stay flat; fixing `β` spans a cone rather than
a plane, so the top and bottom of the field are curved. That is the honest shape — a lens that
sees 95° off-axis does not do so along a straight edge.

Two consequences worth stating:

- **`axis` does not apply.** A flat plane at `range` along the boresight is unreachable for any
  direction more than 90° off it. A wide field is drawn radially whichever mode is set.
- **The split is at exactly 180°**, where the rectilinear model stops existing rather than merely
  straining. It strains well before: a 170° lens has `ty = 11.4`, so its top corners sit 2.9°
  above the horizon instead of `vfov/2`. A figure below 180° is still taken at face value as a
  rectilinear field, because that is what every ordinary camera and every acceptance test assumes.
  Distinguishing a 170° fisheye from a 170° rectilinear lens needs a projection model recorded per
  sensor, which the catalogue does not yet carry.

The cap is tessellated (12 × 6) so the solid stays a convex polyhedron and the ground section
below needs no new algorithm; the far edge of the footprint comes out as a fine polyline rather
than a true arc. The wireframe draws `Frustum.outline` — the rim and four spokes — rather than
every tessellation edge.

The rest of this section describes the `axis` pyramid.

With `ty = tan(hfov/2)`, `tz = tan(vfov/2)`, `R_ = range`, the four far corners in the local
frame are:

```
( R_,  ty·R_,  tz·R_ )
( R_, −ty·R_,  tz·R_ )
( R_, −ty·R_, −tz·R_ )
( R_,  ty·R_, −tz·R_ )
```

World position of each corner = `sensorPosition + R · localCorner`.

Clamp `hfov` and `vfov` to `[0.2°, 179.4°]` here so the tangent stays finite — this is the
rectilinear model, and 179.4° is the widest one exists. The angular sweep has no such ceiling and
is clamped only at `hfov ≤ 360°`, `vfov ≤ 180°`, where the patch would start covering ground it
has already covered. Clamp `range` to at least 0.05 m.

The pyramid has 5 vertices — apex plus 4 far corners — and 8 edges:

```
[0,1] [0,2] [0,3] [0,4]   apex to each far corner
[1,2] [2,3] [3,4] [4,1]   around the far plane
```

Triangulate as `0,1,2  0,2,3  0,3,4  0,4,1  1,2,3  1,3,4` — four lateral faces plus the far plane
split in two.

## Ground coverage polygon

The exact cross-section of the pyramid with the plane `z = 0`.

The pyramid is convex, so the section's vertices are precisely the intersections of its 8 edges
with the plane. Nothing else is needed.

For each edge with endpoints `a`, `b`:
- If `a.z` and `b.z` are strictly on the same side of zero, skip.
- If `a.z === b.z`, skip.
- Otherwise `t = a.z / (a.z − b.z)`, and the intersection is `lerp(a, b, t)`.

Then sort the resulting points by angle about their centroid, drop points closer than `1e-6` to
their predecessor, and return the polygon if at least 3 points remain, otherwise `null`.

**Do not approximate this by ray-marching, sampling, or projecting the far plane.**

### Derived readouts

- **Area** — shoelace formula on the polygon.
- **X and Y extents** — min and max of the polygon coordinates.
- **Blind gap** — the shortest distance from the vehicle footprint to the nearest point of the
  coverage polygon.

Compute the blind gap in closed form, not by sampling. For every polygon edge and every footprint
edge, take the minimum segment-to-segment distance; if the polygon overlaps the footprint at all,
the gap is 0. A correct helper is `pointToSegmentDistance` plus a segment intersection test.

> The previous prototype sampled each polygon edge at `t += 0.02`. That is wrong at large
> footprints and must not be carried over.

### Body shape

The footprint is `[−L/2, L/2] × [−W/2, W/2]` shrunk on each side by a corner radius `r` and swept
back out by a disc of radius `r` — `core/footprint.ts`. One family covers all three settings:
`box` is `r = 0`, `rounded` is the user's figure clamped to `min(L, W) / 2`, and `cylinder` is that
maximum, giving a circle when `L = W` and a stadium when they differ.

Being a Minkowski sum keeps every query closed form, and each collapses to the old rectangle
arithmetic exactly at `r = 0`:

- **inside test** — `length(max(|p| − inner, 0)) + min(max(qx, qy), 0) − r ≤ 0`. The second term is
  what makes the interior correct rather than flat zero.
- **exit radius** for the sector report — the flat sides give it directly; a ray leaving through a
  corner arc solves `|t·(a,b) − inner| = r`, a quadratic in `t`.
- **snap** — nearest point of the inner box, then a step of `r` outwards in plan. Only the vertical
  edges are rounded, so the roof and the underside stay flat.

Every measurement follows the shape, so the drawing and the numbers cannot disagree: rounding a
corner really removes that corner from the footprint, the blind gap and the body warning.

### Body warning

If the sensor position falls inside the body — inside the footprint, and
`clearance ≤ z ≤ clearance + H` — show a warning that the body will occlude it. v1 does not model
the occlusion itself.

## Blind spot report

Divide the azimuth around the origin into 72 sectors of 5°. For each sector, walk outward and
find the nearest radius at which any sensor's ground polygon covers the sector's centre ray. Report
sectors where no coverage exists within 5 m of the vehicle footprint. A point-in-polygon test on
the ray at a few radii is sufficient — this is a report, not a physics simulation.

Debounce this to ~150 ms; never run it inside the render loop.

## Acceptance tests

These go in `core/__tests__/geometry.test.ts` and must pass at all times. Tolerance `1e-4`.

| # | Input | Expected |
|---|---|---|
| 1 | `R(0, 0, 0) · (1,0,0)` | `(1, 0, 0)` |
| 2 | `R(yaw=90) · (1,0,0)` | `(0, 1, 0)` — yaw + turns left |
| 3 | `R(pitch=−30) · (1,0,0)` | `(0.8660, 0, −0.5)` — pitch − points down |
| 4 | `R(pitch=+30) · (1,0,0)` | `(0.8660, 0, +0.5)` |
| 5 | `R(yaw=180, pitch=−20) · (1,0,0)` | `(−0.9397, 0, −0.3420)` |
| 6 | any yaw/pitch/roll | `RᵀR = I` |
| 7 | `z=2, pitch=−90, 90°×90°, range 10` | ground polygon is exactly `x, y ∈ [−2, 2]`, area `16 m²` |
| 8 | `z=2, pitch=−45, hfov 60, vfov 90, long range` | near edge at `x = 0`, `y = ±0.8165` |
| 9 | `z=1, pitch=0, 90°×90°` | near edge at `x = 1` |
| 10 | canvas 1601 × 901 | the four viewport rects tile it with zero gap and zero overlap |

Test 6 should be a property test over a few dozen random poses.
