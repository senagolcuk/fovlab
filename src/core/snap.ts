/**
 * Snap to the vehicle body.
 *
 * Sensors are mounted on surfaces, so a drag that lands near the body should stick to it and
 * point out of the face it landed on. Closed form rather than a raycast: the target is an
 * axis-aligned box, so the nearest surface point and its outward normal fall straight out of
 * the coordinates.
 */

import { cornerRadius } from './footprint';
import { clamp } from './rotation';
import type { Vec3, Vehicle } from './types';

/** How close a drag must come to the body before it sticks. */
export const SNAP_DISTANCE = 0.15;

export interface BodyBox {
  min: Vec3;
  max: Vec3;
}

export function bodyBox(vehicle: Vehicle): BodyBox {
  return {
    min: [-vehicle.length / 2, -vehicle.width / 2, vehicle.clearance],
    max: [vehicle.length / 2, vehicle.width / 2, vehicle.clearance + vehicle.height],
  };
}

export interface SurfacePoint {
  position: Vec3;
  /** Unit outward normal of the face the point landed on. */
  normal: Vec3;
  /** Distance from the query point to the surface. Zero when the point is on it. */
  distance: number;
}

/**
 * The nearest point on the box surface, whether the query point is inside or outside.
 *
 * Outside, the normal points from the box towards the query point. Inside, it is the outward
 * normal of the closest face — dragging a sensor into the body pushes it out of the nearest
 * panel, which is what a mounting position means.
 */
export function nearestSurfacePoint(p: Vec3, box: BodyBox): SurfacePoint {
  const inside =
    p[0] >= box.min[0] &&
    p[0] <= box.max[0] &&
    p[1] >= box.min[1] &&
    p[1] <= box.max[1] &&
    p[2] >= box.min[2] &&
    p[2] <= box.max[2];

  if (!inside) {
    const closest: Vec3 = [
      clamp(p[0], box.min[0], box.max[0]),
      clamp(p[1], box.min[1], box.max[1]),
      clamp(p[2], box.min[2], box.max[2]),
    ];
    const d: Vec3 = [p[0] - closest[0], p[1] - closest[1], p[2] - closest[2]];
    const distance = Math.hypot(d[0], d[1], d[2]);
    // On the surface exactly: fall through to the face test so the normal is still defined.
    if (distance > 1e-9) {
      return {
        position: closest,
        normal: [d[0] / distance, d[1] / distance, d[2] / distance],
        distance,
      };
    }
  }

  // Inside, or exactly on the surface: pick the face with the shortest way out.
  const faces: Array<{ axis: 0 | 1 | 2; sign: -1 | 1; gap: number }> = [
    { axis: 0, sign: -1, gap: p[0] - box.min[0] },
    { axis: 0, sign: 1, gap: box.max[0] - p[0] },
    { axis: 1, sign: -1, gap: p[1] - box.min[1] },
    { axis: 1, sign: 1, gap: box.max[1] - p[1] },
    { axis: 2, sign: -1, gap: p[2] - box.min[2] },
    { axis: 2, sign: 1, gap: box.max[2] - p[2] },
  ];

  let best = faces[0];
  for (const f of faces) if (f.gap < best.gap) best = f;

  const position: Vec3 = [p[0], p[1], p[2]];
  position[best.axis] = best.sign === 1 ? box.max[best.axis] : box.min[best.axis];

  const normal: Vec3 = [0, 0, 0];
  normal[best.axis] = best.sign;

  return { position, normal, distance: Math.max(best.gap, 0) };
}

/**
 * The nearest point on a body whose vertical edges are rounded by `r`.
 *
 * The solid is the inner box swept by a disc of radius `r` in plan, so the answer is: find the
 * nearest point of the inner box, then step `r` outwards along the plan direction. At `r = 0`
 * this is the plain box, and it delegates so that case keeps exactly the behaviour it had.
 */
export function nearestSurfacePointRounded(p: Vec3, box: BodyBox, r: number): SurfacePoint {
  if (r <= 1e-9) return nearestSurfacePoint(p, box);

  const ixMin = box.min[0] + r;
  const ixMax = box.max[0] - r;
  const iyMin = box.min[1] + r;
  const iyMax = box.max[1] - r;
  const zLow = box.min[2];
  const zHigh = box.max[2];

  const cx = clamp(p[0], ixMin, ixMax);
  const cy = clamp(p[1], iyMin, iyMax);
  const vx = p[0] - cx;
  const vy = p[1] - cy;
  const dh = Math.hypot(vx, vy);

  if (dh > r || p[2] < zLow || p[2] > zHigh) {
    const onOutline = dh > r;
    const surface: Vec3 = [
      onOutline ? cx + (vx / dh) * r : p[0],
      onOutline ? cy + (vy / dh) * r : p[1],
      clamp(p[2], zLow, zHigh),
    ];
    const d: Vec3 = [p[0] - surface[0], p[1] - surface[1], p[2] - surface[2]];
    const distance = Math.hypot(d[0], d[1], d[2]);
    if (distance > 1e-9) {
      return {
        position: surface,
        normal: [d[0] / distance, d[1] / distance, d[2] / distance],
        distance,
      };
    }
  }

  // Inside. Compare the way out through the flank against the two caps.
  let sideGap: number;
  let sideNormal: [number, number];
  let sideXY: [number, number];

  if (dh > 1e-9) {
    // Already in the rounded band: straight out along the same direction.
    sideGap = r - dh;
    sideNormal = [vx / dh, vy / dh];
    sideXY = [cx + sideNormal[0] * r, cy + sideNormal[1] * r];
  } else {
    // Within the inner rectangle: out through the nearest flat side, then the radius on top.
    const faces: Array<{ n: [number, number]; gap: number; xy: [number, number] }> = [
      { n: [-1, 0], gap: p[0] - ixMin, xy: [box.min[0], p[1]] },
      { n: [1, 0], gap: ixMax - p[0], xy: [box.max[0], p[1]] },
      { n: [0, -1], gap: p[1] - iyMin, xy: [p[0], box.min[1]] },
      { n: [0, 1], gap: iyMax - p[1], xy: [p[0], box.max[1]] },
    ];
    let best = faces[0];
    for (const f of faces) if (f.gap < best.gap) best = f;
    sideGap = best.gap + r;
    sideNormal = best.n;
    sideXY = best.xy;
  }

  const downGap = p[2] - zLow;
  const upGap = zHigh - p[2];

  if (sideGap <= downGap && sideGap <= upGap) {
    return {
      position: [sideXY[0], sideXY[1], p[2]],
      normal: [sideNormal[0], sideNormal[1], 0],
      distance: Math.max(sideGap, 0),
    };
  }
  if (downGap <= upGap) {
    return { position: [p[0], p[1], zLow], normal: [0, 0, -1], distance: Math.max(downGap, 0) };
  }
  return { position: [p[0], p[1], zHigh], normal: [0, 0, 1], distance: Math.max(upGap, 0) };
}

/** The snapped pose, or null when the point is further from the body than `tolerance`. */
export function snapToBody(
  p: Vec3,
  vehicle: Vehicle,
  tolerance = SNAP_DISTANCE,
): SurfacePoint | null {
  const hit = nearestSurfacePointRounded(p, bodyBox(vehicle), cornerRadius(vehicle));
  return hit.distance <= tolerance ? hit : null;
}
