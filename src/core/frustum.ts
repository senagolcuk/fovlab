/**
 * The FOV volume: a set of directions, taken out to `range`.
 *
 * Two independent choices decide the shape.
 *
 * The **directions** come from the field's own width. Below 180° they are the ones a flat image
 * rectangle subtends — the rectangular cone the documents specify. At 180° and beyond no such
 * rectangle exists, so they are swept by angle instead. See `localDirection`.
 *
 * The **far surface** is `Layout.rangeMode`: a flat plane at `range` along the boresight (`axis`),
 * or every direction at `range` (`radial`). A flat plane is unreachable for directions more than
 * 90° off the boresight, so a field wider than that is always drawn radially.
 */

import { applyMat3, clamp, DEG, rotationMatrix } from './rotation';
import type { Frustum, FovSpec, Mat3, Pose, RangeMode, Vec3 } from './types';

export const FOV_MIN = 0.2;

/**
 * The widest a *rectangular cone* can be, in either axis.
 *
 * The rectilinear model puts a flat image rectangle at unit distance and reads the field off its
 * half-width `tan(hfov/2)`. At 180° that tangent is infinite, and it degenerates well before:
 * a 170° lens has `ty = 11.4`, so its top corners sit 2.9° above the horizon instead of `vfov/2`,
 * and the field pinches shut at the sides. Past 180° there is no rectangle at all — no flat image
 * plane subtends a reflex angle. This is a property of the optics, not of the arithmetic.
 */
export const AXIS_FOV_MAX = 179.4;

/**
 * The widest an *angular sweep* can be. It has no tangent to keep finite, so the only limits are
 * the ones where the patch starts covering ground it has already covered: a full turn of azimuth
 * and a half turn of elevation together are the whole sphere.
 */
export const HFOV_MAX = 360;
export const VFOV_MAX = 180;

/** The widest angle a datasheet may state. Both models are drawn at the figure entered. */
export const FOV_INPUT_MAX = 360;
export const RANGE_MIN = 0.05;

/**
 * Whether this spec is past what a rectangular cone can express, and so is swept by angle.
 *
 * Split at exactly 180° because that is where the rectilinear model stops existing rather than
 * merely straining. A figure below it is taken at face value as a rectilinear field, which is what
 * every acceptance test and every ordinary camera assumes.
 */
export function isWideField(spec: FovSpec): boolean {
  return spec.hfov >= 180 || spec.vfov >= 180;
}

/** apex to each far corner, then around the far plane */
export const FRUSTUM_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 1],
];

/** Four lateral faces plus the far plane split in two. */
export const FRUSTUM_TRIANGLES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [0, 2, 3],
  [0, 3, 4],
  [0, 4, 1],
  [1, 2, 3],
  [1, 3, 4],
];

export function clampFov(deg: number, max: number = HFOV_MAX): number {
  return clamp(Number.isFinite(deg) ? deg : FOV_MIN, FOV_MIN, max);
}

export function clampRange(m: number): number {
  const v = Number.isFinite(m) ? m : RANGE_MIN;
  return v < RANGE_MIN ? RANGE_MIN : v;
}

export function clampSpec(spec: FovSpec): FovSpec {
  return {
    hfov: clampFov(spec.hfov, HFOV_MAX),
    vfov: clampFov(spec.vfov, VFOV_MAX),
    range: clampRange(spec.range),
  };
}

/** The four far corners in the sensor local frame. Rectilinear, so clamped to what one can be. */
export function localFarCorners(spec: FovSpec): [Vec3, Vec3, Vec3, Vec3] {
  const hfov = clampFov(spec.hfov, AXIS_FOV_MAX);
  const vfov = clampFov(spec.vfov, AXIS_FOV_MAX);
  const range = clampRange(spec.range);
  const ty = Math.tan((hfov / 2) * DEG) * range;
  const tz = Math.tan((vfov / 2) * DEG) * range;
  return [
    [range, ty, tz],
    [range, -ty, tz],
    [range, -ty, -tz],
    [range, ty, -tz],
  ];
}

export function poseMatrix(pose: Pose): Mat3 {
  return rotationMatrix(pose.yaw, pose.pitch, pose.roll);
}

/**
 * Cap tessellation, in degrees per facet rather than a fixed segment count.
 *
 * A fixed count makes the facet size scale with the FOV: twelve segments is 2.5° on a 30° lens but
 * 10° on a 120° one, and at 10° the arc reads as a row of straight edges. Holding the angle
 * constant keeps every sensor equally round and leaves narrow ones cheap.
 *
 * The same angle both ways. Vertical used to be ten degrees on the reasoning that horizontal is
 * the one you see — true of TOP, and wrong about FRONT and LEFT, where the vertical sweep is the
 * arc and a 60° lens came out as six visible straight runs.
 */
const DEG_PER_FACET = 3;

function segments(angleDeg: number, perFacet: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.ceil(angleDeg / perFacet)));
}

/**
 * The direction a grid coordinate `u, v` in `[-1, 1]²` points, as a unit vector.
 *
 * Two models, because a field of view is two different shapes either side of 180°.
 *
 * **Rectilinear** — `(1, u·ty, v·tz)` normalised. The directions a flat image rectangle subtends,
 * which is what HFOV and VFOV mean on any ordinary lens. Its lateral faces are planar (fixing
 * `u = ±1` spans a plane, and so does fixing `v = ±1`), so the ground section has straight sides
 * and a straight near edge. Acceptance tests 7, 8 and 9 pin exactly that.
 *
 * **Angular** — azimuth `α` and elevation `β` swept directly:
 *
 * ```
 * d = (cos β · cos α, cos β · sin α, sin β)
 * ```
 *
 * There is no tangent, so it is defined at every angle including reflex ones. This is what a
 * fisheye's quoted figures mean: 190° is 190° of sweep, not the diagonal of an impossible
 * rectangle. Fixing `α` still spans a plane, so the *sides* stay flat; fixing `β` spans a cone
 * rather than a plane, so the top and bottom of the field are curved. That is the honest shape —
 * a lens that sees 95° off-axis does not do so along a straight edge.
 */
function localDirection(u: number, v: number, hfov: number, vfov: number, wide: boolean): Vec3 {
  if (wide) {
    const a = (u * hfov * DEG) / 2;
    const b = (v * vfov * DEG) / 2;
    const cb = Math.cos(b);
    return [cb * Math.cos(a), cb * Math.sin(a), Math.sin(b)];
  }
  const ty = Math.tan((hfov / 2) * DEG);
  const tz = Math.tan((vfov / 2) * DEG);
  const d: Vec3 = [1, u * ty, v * tz];
  const len = Math.hypot(d[0], d[1], d[2]);
  return [d[0] / len, d[1] / len, d[2] / len];
}

/**
 * The far surface, in the sensor local frame: every direction taken out to exactly `range`.
 *
 * A spherical cap under the rectilinear model, a spherical patch under the angular one. Either
 * way every point is `range` from the apex, which is the whole of what `radial` promises.
 */
function localCapGrid(spec: FovSpec, nh: number, nv: number): Vec3[] {
  const { hfov, vfov, range } = clampSpec(spec);
  const wide = isWideField({ hfov, vfov, range });
  const points: Vec3[] = [];
  for (let i = 0; i <= nh; i++) {
    const u = -1 + (2 * i) / nh;
    for (let j = 0; j <= nv; j++) {
      const v = -1 + (2 * j) / nv;
      const d = localDirection(u, v, hfov, vfov, wide);
      points.push([range * d[0], range * d[1], range * d[2]]);
    }
  }
  return points;
}

/** Edges, triangles and silhouette for one grid size. Built once per shape and reused. */
const topologyCache = new Map<string, Omit<Frustum, 'vertices'>>();

function capTopology(nh: number, nv: number): Omit<Frustum, 'vertices'> {
  const key = `${nh}x${nv}`;
  const cached = topologyCache.get(key);
  if (cached) return cached;

  const at = (i: number, j: number) => 1 + i * (nv + 1) + j;
  const edges: Array<readonly [number, number]> = [];
  const triangles: Array<readonly [number, number, number]> = [];

  for (let i = 0; i <= nh; i++) {
    for (let j = 0; j <= nv; j++) {
      if (j < nv) edges.push([at(i, j), at(i, j + 1)]);
      if (i < nh) edges.push([at(i, j), at(i + 1, j)]);
      if (i < nh && j < nv) {
        triangles.push([at(i, j), at(i + 1, j), at(i + 1, j + 1)]);
        triangles.push([at(i, j), at(i + 1, j + 1), at(i, j + 1)]);
      }
    }
  }

  // The rim, walked as a loop, fanned back to the apex. Every rim vertex gets an edge to the
  // apex: they lie on the planar lateral faces, so the extra points a ground cut picks up are
  // collinear along the face rather than inside the section.
  const rim: number[] = [];
  for (let j = 0; j < nv; j++) rim.push(at(0, j));
  for (let i = 0; i < nh; i++) rim.push(at(i, nv));
  for (let j = nv; j > 0; j--) rim.push(at(nh, j));
  for (let i = nh; i > 0; i--) rim.push(at(i, 0));

  for (let k = 0; k < rim.length; k++) {
    edges.push([0, rim[k]]);
    triangles.push([0, rim[k], rim[(k + 1) % rim.length]]);
  }

  // The silhouette: the rim as a closed loop, plus a spoke to each of the four corners.
  const outline: Array<readonly [number, number]> = [];
  for (let k = 0; k < rim.length; k++) outline.push([rim[k], rim[(k + 1) % rim.length]]);
  for (const corner of [at(0, 0), at(nh, 0), at(nh, nv), at(0, nv)]) outline.push([0, corner]);

  const topology = { edges, triangles, outline };
  topologyCache.set(key, topology);
  return topology;
}

/** Apex plus the far surface, in world coordinates. */
export function frustum(pose: Pose, spec: FovSpec, mode: RangeMode = 'axis'): Frustum {
  const R = poseMatrix(pose);
  const origin: Vec3 = [pose.x, pose.y, pose.z];
  const toWorld = (c: Vec3): Vec3 => {
    const w = applyMat3(R, c);
    return [origin[0] + w[0], origin[1] + w[1], origin[2] + w[2]];
  };

  // A flat far plane is the set of points at `range` *along the boresight*. Only directions
  // within 90° of the boresight ever reach it; at 90° they run parallel to it and never do. So a
  // field wider than that has no `axis` surface to be drawn on — the mode is undefined for it, not
  // merely inconvenient. Falling back to the far surface that does exist beats drawing a pyramid
  // whose corners have been quietly cut back to 179.4°, which is a picture of a different sensor.
  if (mode === 'radial' || isWideField(spec)) {
    const { hfov, vfov } = clampSpec(spec);
    const nh = segments(hfov, DEG_PER_FACET, 8, 72);
    const nv = segments(vfov, DEG_PER_FACET, 8, 72);
    return {
      vertices: [origin, ...localCapGrid(spec, nh, nv).map(toWorld)],
      ...capTopology(nh, nv),
    };
  }

  const corners = localFarCorners(spec).map(toWorld);
  return {
    vertices: [origin, corners[0], corners[1], corners[2], corners[3]],
    edges: FRUSTUM_EDGES,
    outline: FRUSTUM_EDGES,
    triangles: FRUSTUM_TRIANGLES,
  };
}

/** Unit vector along the optical axis, in world coordinates. */
export function opticalAxis(pose: Pose): Vec3 {
  return applyMat3(poseMatrix(pose), [1, 0, 0]);
}
