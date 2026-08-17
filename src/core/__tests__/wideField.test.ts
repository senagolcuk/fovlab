/**
 * Fields of 180° and wider.
 *
 * A rectangular cone cannot express one: its half-width is `tan(fov/2)`, and no flat image
 * rectangle subtends a reflex angle. So past 180° the directions are swept by angle instead, and
 * the quoted figure is drawn rather than stood in for. Everything narrower is untouched — the
 * acceptance tests pin the rectilinear model and it is still the one they get.
 */

import { describe, expect, it } from 'vitest';
import { frustum, isWideField, HFOV_MAX, VFOV_MAX, clampSpec } from '../frustum';
import { groundPolygon } from '../ground';
import type { Frustum, Pose, Vec3 } from '../types';

const pose = (p: Partial<Pose> = {}): Pose => ({
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  pitch: 0,
  roll: 0,
  ...p,
});

/** Azimuth and elevation of every far-surface vertex, in the sensor frame. */
function sweep(f: Frustum): { azimuth: number; elevation: number } {
  const [ax, ay, az] = f.vertices[0];
  const local = f.vertices.slice(1).map((v): Vec3 => [v[0] - ax, v[1] - ay, v[2] - az]);
  const r = Math.hypot(local[0][0], local[0][1], local[0][2]);
  const deg = 180 / Math.PI;
  const azimuths = local.map((d) => Math.atan2(d[1], d[0]) * deg);
  const elevations = local.map((d) => Math.asin(Math.min(1, Math.max(-1, d[2] / r))) * deg);
  return {
    azimuth: Math.max(...azimuths) - Math.min(...azimuths),
    elevation: Math.max(...elevations) - Math.min(...elevations),
  };
}

describe('wide fields', () => {
  it('splits at 180°, where the rectangular cone stops existing', () => {
    expect(isWideField({ hfov: 179.9, vfov: 60, range: 10 })).toBe(false);
    expect(isWideField({ hfov: 180, vfov: 60, range: 10 })).toBe(true);
    expect(isWideField({ hfov: 90, vfov: 200, range: 10 })).toBe(true);
  });

  it('sweeps exactly the angle stated, not a clamped stand-in', () => {
    for (const [hfov, vfov] of [
      [180, 90],
      [190, 60],
      [220, 40],
      [270, 120],
    ]) {
      const s = sweep(frustum(pose(), { hfov, vfov, range: 1 }));
      expect(s.azimuth).toBeCloseTo(hfov, 6);
      expect(s.elevation).toBeCloseTo(vfov, 6);
    }
  });

  it('keeps every point at the range, as the far surface does at any width', () => {
    const p = pose({ x: 3, y: -2, z: 1.4, yaw: 37, pitch: -18, roll: 12 });
    const f = frustum(p, { hfov: 190, vfov: 70, range: 12 });
    for (const v of f.vertices.slice(1)) {
      expect(Math.hypot(v[0] - p.x, v[1] - p.y, v[2] - p.z)).toBeCloseTo(12, 9);
    }
  });

  it('reaches behind its own apex, which is the whole point of exceeding 180°', () => {
    // 190° horizontal on a bumper: 5° of the field lies behind the mounting point on each side.
    const apexX = 2;
    const f = frustum(pose({ x: apexX, z: 0.6 }), { hfov: 190, vfov: 60, range: 10 });
    const poly = groundPolygon(f)!;
    const backward = apexX - Math.min(...poly.map((q) => q[0]));
    expect(backward).toBeGreaterThan(0);
    // Nothing may pass the range, wrap-around included.
    for (const [x, y] of poly) {
      expect(Math.hypot(x - apexX, y, 0.6)).toBeLessThanOrEqual(10 + 1e-6);
    }
    // A 190° fan reaches nearly the full range straight out to the sides; 179° cannot.
    expect(Math.max(...poly.map((q) => Math.abs(q[1])))).toBeGreaterThan(9);
  });

  it('survives the full sphere without a NaN', () => {
    const f = frustum(pose({ z: 5 }), { hfov: HFOV_MAX, vfov: VFOV_MAX, range: 3 });
    expect(f.vertices.every((v) => v.every(Number.isFinite))).toBe(true);
    for (const v of f.vertices.slice(1)) {
      expect(Math.hypot(v[0], v[1], v[2] - 5)).toBeCloseTo(3, 9);
    }
  });

  it('clamps only where the shape would start repeating itself', () => {
    expect(clampSpec({ hfov: 400, vfov: 200, range: 5 })).toEqual({
      hfov: HFOV_MAX,
      vfov: VFOV_MAX,
      range: 5,
    });
    expect(clampSpec({ hfov: 190, vfov: 60, range: 5 }).hfov).toBe(190);
  });
});
