/**
 * The vehicle's plan-view outline.
 *
 * One shape family serves all three settings: a rectangle shrunk by `r` on each side and
 * inflated back out by a disc of radius `r`. `box` is `r = 0`, `rounded` is whatever the user
 * asked for, and `cylinder` is `r` at its maximum. Because it is a Minkowski sum, every query
 * the tool needs — inside test, signed distance, the radius at which a ray leaves — stays in
 * closed form, and each one collapses to the old rectangle arithmetic exactly when `r = 0`.
 */

import type { Vec2, Vehicle } from './types';

/** Segments per quarter turn when the outline is handed out as a polygon. */
const ARC_SEGMENTS = 8;

/** The radius actually in force, clamped so the corners can never overrun the body. */
export function cornerRadius(vehicle: Vehicle): number {
  const limit = Math.min(vehicle.length, vehicle.width) / 2;
  if (vehicle.shape === 'box') return 0;
  if (vehicle.shape === 'cylinder') return limit;
  return Math.max(0, Math.min(vehicle.cornerRadius, limit));
}

/** Half-extents of the rectangle the corner discs are swept around. */
export function innerHalfExtents(vehicle: Vehicle): Vec2 {
  const r = cornerRadius(vehicle);
  return [Math.max(0, vehicle.length / 2 - r), Math.max(0, vehicle.width / 2 - r)];
}

/**
 * Signed distance from a plan-view point to the outline: negative inside, zero on it.
 *
 * The `min(max(qx, qy), 0)` term is what makes the interior correct rather than flat zero, and
 * it is why this reduces to the plain box distance when `r = 0`.
 */
export function footprintDistance(p: Vec2, vehicle: Vehicle): number {
  const r = cornerRadius(vehicle);
  const [iL, iW] = innerHalfExtents(vehicle);
  const qx = Math.abs(p[0]) - iL;
  const qy = Math.abs(p[1]) - iW;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - r;
}

export function isInsideFootprint(p: Vec2, vehicle: Vehicle): boolean {
  return footprintDistance(p, vehicle) <= 0;
}

/**
 * The outline as a counter-clockwise polygon. Four points when `r = 0`, so the blind gap keeps
 * measuring against the same four edges it always did.
 */
export function footprintPolygon(vehicle: Vehicle): Vec2[] {
  const r = cornerRadius(vehicle);
  const [iL, iW] = innerHalfExtents(vehicle);

  if (r <= 0) {
    return [
      [iL, iW],
      [-iL, iW],
      [-iL, -iW],
      [iL, -iW],
    ];
  }

  const points: Vec2[] = [];
  // Corner centres in counter-clockwise order, each with the angle its arc starts at.
  const corners: Array<[number, number, number]> = [
    [iL, iW, 0],
    [-iL, iW, Math.PI / 2],
    [-iL, -iW, Math.PI],
    [iL, -iW, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= ARC_SEGMENTS; i++) {
      const a = start + (i / ARC_SEGMENTS) * (Math.PI / 2);
      points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return points;
}

/**
 * Radius at which a ray leaving the origin crosses the outline.
 *
 * Flat sides give it directly; a ray that leaves through a corner arc solves a quadratic. With
 * `r = 0` the arc case cannot arise and this is the old `min(hl/|cos|, hw/|sin|)`.
 */
export function footprintExitRadius(cos: number, sin: number, vehicle: Vehicle): number {
  const r = cornerRadius(vehicle);
  const [iL, iW] = innerHalfExtents(vehicle);
  const a = Math.abs(cos);
  const b = Math.abs(sin);

  // Straight out of a flat side, if the ray is still on the flat part when it gets there.
  if (a > 1e-12) {
    const t = (iL + r) / a;
    if (t * b <= iW + 1e-12) return t;
  }
  if (b > 1e-12) {
    const t = (iW + r) / b;
    if (t * a <= iL + 1e-12) return t;
  }
  if (r <= 0) return 0;

  // Through a corner arc: |t·(a,b) − (iL,iW)| = r, with a² + b² = 1.
  const k = a * iL + b * iW;
  const c = iL * iL + iW * iW - r * r;
  const disc = k * k - c;
  return disc <= 0 ? k : k + Math.sqrt(disc);
}
