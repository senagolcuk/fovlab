/**
 * The FOV volume: a rectangular pyramid with a flat far plane at `range`, measured along
 * the optical axis. Not a sphere and not a spherical cap.
 */

import { applyMat3, clamp, DEG, rotationMatrix } from './rotation';
import type { Frustum, FovSpec, Mat3, Pose, RangeMode, Vec3 } from './types';

/** Keeps tan(fov/2) finite. */
export const FOV_MIN = 0.2;
export const FOV_MAX = 179.4;
/**
 * The widest angle a datasheet may state. A pyramid cannot draw past `FOV_MAX`, but fisheye and
 * other wide sensors really do quote figures beyond 180°, so the number is recorded faithfully and
 * only the geometry is clamped (see `clampSpec`).
 */
export const FOV_INPUT_MAX = 360;
export const RANGE_MIN = 0.05;

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

export function clampFov(deg: number): number {
  return clamp(Number.isFinite(deg) ? deg : FOV_MIN, FOV_MIN, FOV_MAX);
}

export function clampRange(m: number): number {
  const v = Number.isFinite(m) ? m : RANGE_MIN;
  return v < RANGE_MIN ? RANGE_MIN : v;
}

export function clampSpec(spec: FovSpec): FovSpec {
  return {
    hfov: clampFov(spec.hfov),
    vfov: clampFov(spec.vfov),
    range: clampRange(spec.range),
  };
}

/** The four far corners in the sensor local frame, at the clamped spec. */
export function localFarCorners(spec: FovSpec): [Vec3, Vec3, Vec3, Vec3] {
  const { hfov, vfov, range } = clampSpec(spec);
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
 * The spherical-cap far surface, in the sensor local frame.
 *
 * Sweeps the same directions the pyramid's corners define — `(1, u·ty, v·tz)` for `u, v` in
 * `[-1, 1]` — but normalised and scaled to `range`, so every point is exactly `range` away. The
 * lateral faces stay planar (fixing `u = ±1` still spans a plane), which is why the near edge and
 * the acceptance tests that pin it are untouched.
 */
function localCapGrid(spec: FovSpec, nh: number, nv: number): Vec3[] {
  const { hfov, vfov, range } = clampSpec(spec);
  const ty = Math.tan((hfov / 2) * DEG);
  const tz = Math.tan((vfov / 2) * DEG);
  const points: Vec3[] = [];
  for (let i = 0; i <= nh; i++) {
    const u = -1 + (2 * i) / nh;
    for (let j = 0; j <= nv; j++) {
      const v = -1 + (2 * j) / nv;
      const d: Vec3 = [1, u * ty, v * tz];
      const len = Math.hypot(d[0], d[1], d[2]);
      points.push([(range * d[0]) / len, (range * d[1]) / len, (range * d[2]) / len]);
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

  if (mode === 'radial') {
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
