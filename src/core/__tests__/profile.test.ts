import { describe, expect, it } from 'vitest';
import { isInsideBody } from '../ground';
import { VEHICLE_MODELS, bodyMaxTop, bodySegments, bodyTopAt } from '../profile';
import { SNAP_DISTANCE, nearestOnBody, snapToBody } from '../snap';
import type { Pose, Vehicle, VehicleModel } from '../types';

function vehicle(model: VehicleModel): Vehicle {
  return {
    length: 4.8,
    width: 1.9,
    height: 1.5,
    clearance: 0.2,
    wheelbase: 2.8,
    wheelRadius: 0.34,
    shape: 'box',
    model,
    cornerRadius: 0,
  };
}

function pose(p: Partial<Pose>): Pose {
  return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, ...p };
}

describe('body segments', () => {
  it('covers the whole length exactly, with no gap and no overlap, for every model', () => {
    for (const model of VEHICLE_MODELS) {
      const v = vehicle(model);
      const segs = bodySegments(v).slice().sort((a, b) => a.minX - b.minX);
      expect(segs[0].minX).toBeCloseTo(-v.length / 2, 9);
      expect(segs[segs.length - 1].maxX).toBeCloseTo(v.length / 2, 9);
      for (let i = 1; i < segs.length; i++) {
        expect(segs[i].minX).toBeCloseTo(segs[i - 1].maxX, 9);
      }
    }
  });

  it('never rises above the height the engineer typed, and reaches it somewhere', () => {
    for (const model of VEHICLE_MODELS) {
      const v = vehicle(model);
      const tops = bodySegments(v).map((s) => s.top);
      expect(Math.max(...tops)).toBeCloseTo(bodyMaxTop(v), 9);
      for (const t of tops) expect(t).toBeLessThanOrEqual(bodyMaxTop(v) + 1e-9);
      for (const t of tops) expect(t).toBeGreaterThan(v.clearance);
    }
  });

  it('leaves the bus one block, which is what the tool always drew', () => {
    const v = vehicle('bus');
    const segs = bodySegments(v);
    expect(segs).toHaveLength(1);
    expect(segs[0].top).toBeCloseTo(bodyMaxTop(v), 9);
    // The roofline is the full height at every point along it.
    for (const x of [-2.4, -1, 0, 1, 2.4]) {
      expect(bodyTopAt(x, v)).toBeCloseTo(bodyMaxTop(v), 9);
    }
  });

  it('gives a car a low bonnet, a full-height cabin and a low boot', () => {
    const v = vehicle('car');
    const nose = bodyTopAt(2.2, v);
    const cabin = bodyTopAt(0, v);
    const tail = bodyTopAt(-2.2, v);
    expect(cabin).toBeCloseTo(bodyMaxTop(v), 9);
    expect(nose).toBeLessThan(cabin);
    expect(tail).toBeLessThan(cabin);
  });

  it('gives a van a short bonnet and then full height all the way back', () => {
    const v = vehicle('van');
    expect(bodyTopAt(2.3, v)).toBeLessThan(bodyMaxTop(v));
    for (const x of [1, 0, -1, -2.3]) expect(bodyTopAt(x, v)).toBeCloseTo(bodyMaxTop(v), 9);
  });

  it('reports no body beyond the ends', () => {
    const v = vehicle('car');
    expect(bodyTopAt(3, v)).toBe(v.clearance);
    expect(bodyTopAt(-3, v)).toBe(v.clearance);
  });
});

describe('the occlusion warning follows the roofline', () => {
  const car = vehicle('car');

  it('leaves a camera above a car bonnet in clear air', () => {
    const z = bodyTopAt(2.2, car) + 0.05;
    expect(z).toBeLessThan(bodyMaxTop(car));
    expect(isInsideBody(pose({ x: 2.2, y: 0, z }), car)).toBe(false);
    // The same height amidships is inside the cabin.
    expect(isInsideBody(pose({ x: 0, y: 0, z }), car)).toBe(true);
  });

  it('still fires under the bonnet', () => {
    expect(isInsideBody(pose({ x: 2.2, y: 0, z: 0.4 }), car)).toBe(true);
  });

  it('agrees with the bus everywhere, for a bus', () => {
    const bus = vehicle('bus');
    for (const x of [-2, 0, 2]) {
      expect(isInsideBody(pose({ x, y: 0, z: 1.4 }), bus)).toBe(true);
      expect(isInsideBody(pose({ x, y: 0, z: 1.8 }), bus)).toBe(false);
    }
  });
});

describe('snapping to a stepped body', () => {
  const car = vehicle('car');

  it('lands on the bonnet, not at roof height', () => {
    const bonnetTop = bodyTopAt(2.2, car);
    const hit = snapToBody([2.2, 0, bonnetTop + 0.08], car)!;
    expect(hit).not.toBeNull();
    expect(hit.position[2]).toBeCloseTo(bonnetTop, 9);
    expect(hit.normal).toEqual([0, 0, 1]);
  });

  it('lands on the roof over the cabin', () => {
    const hit = snapToBody([0, 0, bodyMaxTop(car) + 0.08], car)!;
    expect(hit.position[2]).toBeCloseTo(bodyMaxTop(car), 9);
    expect(hit.normal).toEqual([0, 0, 1]);
  });

  it('never returns a point buried inside the body', () => {
    /**
     * On the surface means: step a hair along the outward normal and you are outside. A point
     * buried on the face where two blocks meet fails that, and along the bonnet the windscreen's
     * hidden underside is exactly that trap.
     */
    for (let x = 1.3; x <= 2.4; x += 0.05) {
      const hit = nearestOnBody([x, 0, bodyTopAt(x, car) + 0.05], car);
      const out = pose({
        x: hit.position[0] + hit.normal[0] * 1e-4,
        y: hit.position[1] + hit.normal[1] * 1e-4,
        z: hit.position[2] + hit.normal[2] * 1e-4,
      });
      expect(isInsideBody(out, car)).toBe(false);
    }
  });

  it('still lets go beyond the snap distance', () => {
    const bonnetTop = bodyTopAt(2.2, car);
    expect(snapToBody([2.2, 0, bonnetTop + SNAP_DISTANCE + 0.01], car)).toBeNull();
  });

  it('is unchanged for a bus', () => {
    const bus = vehicle('bus');
    const hit = snapToBody([0, 0, bodyMaxTop(bus) + 0.05], bus)!;
    expect(hit.position).toEqual([0, 0, bodyMaxTop(bus)]);
    expect(hit.normal).toEqual([0, 0, 1]);
  });

  it('snaps to the flank at whatever height the roofline is there', () => {
    const hit = snapToBody([2.2, 1.0, 0.5], car)!;
    expect(hit.position[1]).toBeCloseTo(car.width / 2, 9);
    expect(hit.normal).toEqual([0, 1, 0]);
  });
});
