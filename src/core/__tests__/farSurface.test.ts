/**
 * The far surface: every direction stops at exactly `range`.
 *
 * There used to be a choice here. `axis` put a flat plane at `range` along the boresight, so the
 * corners overshot the stated figure — `range · √(1 + tan²(h/2) + tan²(v/2))`, which for a 150°×20°
 * radar at 80 m is 309 m — and every derived number counted the overshoot as coverage. It was a
 * setting the engineer had to get right on each layout, with one correct answer, and past 90° off
 * the boresight it had no answer at all. So there is no setting any more.
 */

import { describe, expect, it } from 'vitest';
import { frustum } from '../frustum';
import { groundPolygon } from '../ground';
import type { Frustum, Pose } from '../types';

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
function farDistances(f: Frustum): number[] {
  const [ax, ay, az] = f.vertices[0];
  return f.vertices.slice(1).map((v) => Math.hypot(v[0] - ax, v[1] - ay, v[2] - az));
}

describe('far surface', () => {
  it('puts every far point at exactly the range', () => {
    const f = frustum(pose(), { hfov: 150, vfov: 20, range: 80 });
    for (const d of farDistances(f)) expect(d).toBeCloseTo(80, 9);
  });

  it('holds that for any pose, since the surface rides with the sensor', () => {
    const f = frustum(pose({ x: 3, y: -2, z: 1.4, yaw: 37, pitch: -18, roll: 12 }), {
      hfov: 100,
      vfov: 40,
      range: 12,
    });
    for (const d of farDistances(f)) expect(d).toBeCloseTo(12, 9);
  });

  it('bounds the footprint by the range, so no point on the ground is further than it', () => {
    const p = pose({ z: 1, pitch: -20 });
    const poly = groundPolygon(frustum(p, { hfov: 140, vfov: 50, range: 9 }))!;
    for (const [x, y] of poly) {
      expect(Math.hypot(x - p.x, y - p.y, 0 - p.z)).toBeLessThanOrEqual(9 + 1e-6);
    }
  });

  it('rounds the far edge rather than cutting it straight', () => {
    const poly = groundPolygon(frustum(pose({ z: 0.8, pitch: -8 }), {
      hfov: 120,
      vfov: 30,
      range: 10,
    }))!;
    // A flat far plane gave four corners; an arc needs many more.
    expect(poly.length).toBeGreaterThan(8);
  });

  it('leaves the near edge where the lateral faces put it, not where the range does', () => {
    // Acceptance test 9, and the reason the far surface was ever safe to change: the sides of a
    // rectilinear field are planes, and the near edge is cut from them.
    const p = pose({ z: 1, pitch: 0 });
    for (const range of [20, 200, 2000]) {
      const poly = groundPolygon(frustum(p, { hfov: 90, vfov: 90, range }))!;
      expect(Math.min(...poly.map((q) => q[0]))).toBeCloseTo(1, 6);
    }
  });
});
