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

A **rectangular pyramid** with a flat far **plane** at `range` measured along the optical axis —
not a sphere, not a spherical cap.

With `ty = tan(hfov/2)`, `tz = tan(vfov/2)`, `R_ = range`, the four far corners in the local
frame are:

```
( R_,  ty·R_,  tz·R_ )
( R_, −ty·R_,  tz·R_ )
( R_, −ty·R_, −tz·R_ )
( R_,  ty·R_, −tz·R_ )
```

World position of each corner = `sensorPosition + R · localCorner`.

Clamp `hfov` and `vfov` to the range `[0.2°, 179.4°]` so the tangent stays finite. Clamp `range`
to at least 0.05 m.

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
- **Blind gap** — the shortest distance from the vehicle footprint rectangle
  `[−L/2, L/2] × [−W/2, W/2]` to the nearest point of the coverage polygon.

Compute the blind gap in closed form, not by sampling. For every polygon edge and every rectangle
edge, take the minimum segment-to-segment distance; if the polygon overlaps the rectangle at all,
the gap is 0. A correct helper is `pointToSegmentDistance` plus a segment intersection test.

> The previous prototype sampled each polygon edge at `t += 0.02`. That is wrong at large
> footprints and must not be carried over.

### Body warning

If the sensor position falls inside the vehicle box —
`|x| ≤ L/2 && |y| ≤ W/2 && clearance ≤ z ≤ clearance + H` — show a warning that the body will
occlude it. v1 does not model the occlusion itself.

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
