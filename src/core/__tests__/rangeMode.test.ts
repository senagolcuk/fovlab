/**
 * `radial` replaces the flat far plane with a spherical cap. The lateral faces are the same cone
 * either way, so everything the acceptance tests pin about the near edge is untouched — what
 * changes is that the far boundary stops at the stated range instead of overshooting it.
 */

import { describe, expect, it } from 'vitest';
import { frustum } from '../frustum';
import { groundPolygon, polygonArea } from '../ground';
import type { Pose } from '../types';

const pose = (p: Partial<Pose> = {}): Pose => ({
  x: 0,
  y: 0,
  z: 1,
  yaw: 0,
  pitch: 0,
  roll: 0,
  ...p,
});

/** Distance from the apex to each far-surface vertex. */
function farDistances(f: ReturnType<typeof frustum>): number[] {
  const [ax, ay, az] = f.vertices[0];
  return f.vertices.slice(1).map((v) => Math.hypot(v[0] - ax, v[1] - ay, v[2] - az));
}

describe('range mode', () => {
  it('leaves the axis pyramid at five vertices and eight edges', () => {
    const f = frustum(pose(), { hfov: 90, vfov: 60, range: 10 }, 'axis');
    expect(f.vertices).toHaveLength(5);
    expect(f.edges).toHaveLength(8);
  });

  it('defaults to axis, so calling it the old way is unchanged', () => {
    const spec = { hfov: 120, vfov: 90, range: 15 };
    expect(frustum(pose(), spec)).toEqual(frustum(pose(), spec, 'axis'));
  });

  it('overshoots the stated range at the corners in axis mode — the reason radial exists', () => {
    const f = frustum(pose(), { hfov: 150, vfov: 20, range: 80 }, 'axis');
    expect(Math.max(...farDistances(f))).toBeGreaterThan(300);
  });

  it('puts every far point at exactly the range in radial mode', () => {
    const f = frustum(pose(), { hfov: 150, vfov: 20, range: 80 }, 'radial');
    for (const d of farDistances(f)) expect(d).toBeCloseTo(80, 9);
  });

  it('holds that for any pose, since the cap rides with the sensor', () => {
    const f = frustum(pose({ x: 3, y: -2, z: 1.4, yaw: 37, pitch: -18, roll: 12 }), {
      hfov: 100,
      vfov: 40,
      range: 12,
    }, 'radial');
    for (const d of farDistances(f)) expect(d).toBeCloseTo(12, 9);
  });

  it('keeps the same near edge, because the lateral faces are the same cone', () => {
    const spec = { hfov: 90, vfov: 90, range: 40 };
    const p = pose({ z: 1, pitch: 0 });
    const axis = groundPolygon(frustum(p, spec, 'axis'))!;
    const radial = groundPolygon(frustum(p, spec, 'radial'))!;
    // Acceptance test 9: the near edge sits at x = 1.
    expect(Math.min(...axis.map((q) => q[0]))).toBeCloseTo(1, 6);
    expect(Math.min(...radial.map((q) => q[0]))).toBeCloseTo(1, 6);
  });

  it('covers less ground than the pyramid, never more', () => {
    const spec = { hfov: 120, vfov: 60, range: 20 };
    const p = pose({ z: 1.2, pitch: -15 });
    const axis = polygonArea(groundPolygon(frustum(p, spec, 'axis'))!);
    const radial = polygonArea(groundPolygon(frustum(p, spec, 'radial'))!);
    expect(radial).toBeLessThan(axis);
  });

  it('agrees with the pyramid when the ground is cut by the sides, not the far surface', () => {
    // Straight down from 2 m with 90x90 and a range far past the corners: acceptance test 7.
    const spec = { hfov: 90, vfov: 90, range: 10 };
    const p = pose({ z: 2, pitch: -90 });
    const radial = groundPolygon(frustum(p, spec, 'radial'))!;
    expect(polygonArea(radial)).toBeCloseTo(16, 4);
    expect(Math.max(...radial.map((q) => Math.abs(q[0])))).toBeCloseTo(2, 4);
    expect(Math.max(...radial.map((q) => Math.abs(q[1])))).toBeCloseTo(2, 4);
  });

  it('bounds the footprint by the range, so no point is further than it', () => {
    const spec = { hfov: 140, vfov: 50, range: 9 };
    const p = pose({ z: 1, pitch: -20 });
    const poly = groundPolygon(frustum(p, spec, 'radial'))!;
    for (const [x, y] of poly) {
      expect(Math.hypot(x - p.x, y - p.y, 0 - p.z)).toBeLessThanOrEqual(9 + 1e-6);
    }
  });

  it('rounds the far edge rather than cutting it straight', () => {
    const spec = { hfov: 120, vfov: 30, range: 10 };
    const p = pose({ z: 0.8, pitch: -8 });
    const poly = groundPolygon(frustum(p, spec, 'radial'))!;
    // A flat far plane gives four corners; an arc needs many more.
    expect(poly.length).toBeGreaterThan(8);
  });
});
