/**
 * The FOV volume: a rectangular pyramid with a flat far plane at `range`, measured along
 * the optical axis. Not a sphere and not a spherical cap.
 */

import { applyMat3, clamp, DEG, rotationMatrix } from './rotation';
import type { Frustum, FovSpec, Mat3, Pose, Vec3 } from './types';

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

/** Apex plus the four far corners, in world coordinates. */
export function frustum(pose: Pose, spec: FovSpec): Frustum {
  const R = poseMatrix(pose);
  const origin: Vec3 = [pose.x, pose.y, pose.z];
  const corners = localFarCorners(spec).map((c) => {
    const w = applyMat3(R, c);
    return [origin[0] + w[0], origin[1] + w[1], origin[2] + w[2]] as Vec3;
  });
  return { vertices: [origin, corners[0], corners[1], corners[2], corners[3]] };
}

/** Unit vector along the optical axis, in world coordinates. */
export function opticalAxis(pose: Pose): Vec3 {
  return applyMat3(poseMatrix(pose), [1, 0, 0]);
}
