/**
 * Exact intersection of the FOV pyramid with the ground plane z = 0, and the readouts
 * derived from it.
 *
 * The pyramid is convex, so the section's vertices are precisely the intersections of its
 * eight edges with the plane. Nothing is sampled, ray-marched or projected.
 */

import { footprintPolygon, isInsideFootprint } from './footprint';
import { FRUSTUM_EDGES } from './frustum';
import type { Frustum, GroundCoverage, Pose, Vec2, Vec3, Vehicle } from './types';

/** Two vertices closer than this collapse into one. */
const DEDUPE_EPS = 1e-6;

/* ------------------------------------------------------------------ 2D primitives */

export function pointInRect(p: Vec2, halfL: number, halfW: number): boolean {
  return Math.abs(p[0]) <= halfL && Math.abs(p[1]) <= halfW;
}

/** Ray casting. Points exactly on an edge may return either answer. */
export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const crosses = yi > p[1] !== yj > p[1];
    if (crosses && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointToSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function cross2(ox: number, oy: number, ax: number, ay: number, bx: number, by: number): number {
  return (ax - ox) * (by - oy) - (ay - oy) * (bx - ox);
}

export function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const d1 = cross2(c[0], c[1], d[0], d[1], a[0], a[1]);
  const d2 = cross2(c[0], c[1], d[0], d[1], b[0], b[1]);
  const d3 = cross2(a[0], a[1], b[0], b[1], c[0], c[1]);
  const d4 = cross2(a[0], a[1], b[0], b[1], d[0], d[1]);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  // Collinear touches count as intersections; the distance is zero either way.
  const onSeg = (p: Vec2, q: Vec2, r: Vec2) =>
    Math.abs(cross2(p[0], p[1], q[0], q[1], r[0], r[1])) < 1e-12 &&
    Math.min(p[0], q[0]) - 1e-12 <= r[0] &&
    r[0] <= Math.max(p[0], q[0]) + 1e-12 &&
    Math.min(p[1], q[1]) - 1e-12 <= r[1] &&
    r[1] <= Math.max(p[1], q[1]) + 1e-12;
  return onSeg(c, d, a) || onSeg(c, d, b) || onSeg(a, b, c) || onSeg(a, b, d);
}

/** Closed form. Zero when the segments touch or cross. */
export function segmentToSegmentDistance(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointToSegmentDistance(a, c, d),
    pointToSegmentDistance(b, c, d),
    pointToSegmentDistance(c, a, b),
    pointToSegmentDistance(d, a, b),
  );
}

/* ------------------------------------------------------------------ ground section */

/**
 * The polygon where the frustum meets z = 0, wound counter-clockwise, or null when the
 * frustum does not reach the ground.
 */
export function groundPolygon(f: Frustum): Vec2[] | null {
  const v = f.vertices;
  const hits: Vec2[] = [];

  for (const [i, j] of FRUSTUM_EDGES) {
    const a: Vec3 = v[i];
    const b: Vec3 = v[j];
    if (a[2] === b[2]) continue;
    if (a[2] > 0 && b[2] > 0) continue;
    if (a[2] < 0 && b[2] < 0) continue;
    const t = a[2] / (a[2] - b[2]);
    hits.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
  }

  if (hits.length < 3) return null;

  let cx = 0;
  let cy = 0;
  for (const h of hits) {
    cx += h[0];
    cy += h[1];
  }
  cx /= hits.length;
  cy /= hits.length;

  hits.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));

  const poly: Vec2[] = [];
  for (const h of hits) {
    const prev = poly[poly.length - 1];
    if (prev && Math.hypot(h[0] - prev[0], h[1] - prev[1]) < DEDUPE_EPS) continue;
    poly.push(h);
  }
  if (poly.length > 2) {
    const first = poly[0];
    const last = poly[poly.length - 1];
    if (Math.hypot(last[0] - first[0], last[1] - first[1]) < DEDUPE_EPS) poly.pop();
  }

  return poly.length >= 3 ? poly : null;
}

/** Shoelace. Always non-negative. */
export function polygonArea(poly: Vec2[]): number {
  let sum = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    sum += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  }
  return Math.abs(sum) / 2;
}

export function polygonExtents(poly: Vec2[]): { x: [number, number]; y: [number, number] } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { x: [minX, maxX], y: [minY, maxY] };
}

/** The vehicle footprint, counter-clockwise. Four points for a box, an arc per rounded corner. */
export function footprintRect(vehicle: Vehicle): Vec2[] {
  return footprintPolygon(vehicle);
}

/**
 * Shortest distance from the vehicle footprint to the coverage polygon, in closed form.
 * Zero when they overlap at all.
 */
export function blindGap(poly: Vec2[], vehicle: Vehicle): number {
  const rect = footprintPolygon(vehicle);

  for (const p of poly) if (isInsideFootprint(p, vehicle)) return 0;
  for (const r of rect) if (pointInPolygon(r, poly)) return 0;

  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    for (let k = 0, l = rect.length - 1; k < rect.length; l = k++) {
      const d = segmentToSegmentDistance(poly[j], poly[i], rect[l], rect[k]);
      if (d < best) best = d;
      if (best === 0) return 0;
    }
  }
  return best;
}

/** True when the sensor sits inside the vehicle body, which would occlude it. */
export function isInsideBody(pose: Pose, vehicle: Vehicle): boolean {
  return (
    isInsideFootprint([pose.x, pose.y], vehicle) &&
    pose.z >= vehicle.clearance &&
    pose.z <= vehicle.clearance + vehicle.height
  );
}

/** Everything the sensor editor's readout needs, from one frustum. */
export function groundCoverage(f: Frustum, vehicle: Vehicle): GroundCoverage {
  const polygon = groundPolygon(f);
  if (!polygon) {
    return { polygon: null, area: 0, extentX: null, extentY: null, blindGap: null };
  }
  const extents = polygonExtents(polygon);
  return {
    polygon,
    area: polygonArea(polygon),
    extentX: extents.x,
    extentY: extents.y,
    blindGap: blindGap(polygon, vehicle),
  };
}
