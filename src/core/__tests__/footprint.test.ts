/**
 * The three body shapes are one family: a rectangle shrunk by `r` and swept by a disc of `r`.
 * These pin both ends of that — that `r = 0` is still exactly the old rectangle, and that a
 * rounded corner really is cut off rather than merely drawn differently.
 */

import { describe, expect, it } from 'vitest';
import {
  cornerRadius,
  footprintDistance,
  footprintExitRadius,
  footprintPolygon,
  innerHalfExtents,
  isInsideFootprint,
} from '../footprint';
import { isInsideBody } from '../ground';
import { bodyBox, nearestSurfacePoint, nearestSurfacePointRounded, snapToBody } from '../snap';
import type { Vehicle } from '../types';

const base: Vehicle = {
  length: 4.8,
  width: 1.9,
  height: 1.5,
  clearance: 0.2,
  wheelbase: 2.8,
  wheelRadius: 0.34,
  shape: 'box',
  cornerRadius: 0.3,
};

const box: Vehicle = { ...base, shape: 'box' };
const rounded: Vehicle = { ...base, shape: 'rounded', cornerRadius: 0.3 };
const cylinder: Vehicle = { ...base, length: 4, width: 4, shape: 'cylinder' };

describe('corner radius', () => {
  it('is zero for a box, whatever the stored figure says', () => {
    expect(cornerRadius({ ...base, shape: 'box', cornerRadius: 0.9 })).toBe(0);
  });

  it('is half the shorter side for a cylinder', () => {
    expect(cornerRadius(cylinder)).toBe(2);
    expect(cornerRadius({ ...base, shape: 'cylinder' })).toBe(base.width / 2);
  });

  it('never lets a rounded corner overrun the body', () => {
    expect(cornerRadius({ ...base, shape: 'rounded', cornerRadius: 99 })).toBe(base.width / 2);
    expect(cornerRadius({ ...base, shape: 'rounded', cornerRadius: -5 })).toBe(0);
  });
});

describe('footprint outline', () => {
  it('stays the four-corner rectangle for a box', () => {
    expect(footprintPolygon(box)).toEqual([
      [2.4, 0.95],
      [-2.4, 0.95],
      [-2.4, -0.95],
      [2.4, -0.95],
    ]);
  });

  it('collapses the inner rectangle to a point for a circular cylinder', () => {
    expect(innerHalfExtents(cylinder)).toEqual([0, 0]);
  });

  it('keeps every rounded outline point on the outline', () => {
    for (const v of [rounded, cylinder]) {
      for (const p of footprintPolygon(v)) {
        expect(Math.abs(footprintDistance(p, v))).toBeLessThan(1e-9);
      }
    }
  });

  it('reads negative inside and positive outside', () => {
    expect(footprintDistance([0, 0], rounded)).toBeLessThan(0);
    expect(footprintDistance([10, 0], rounded)).toBeCloseTo(10 - 2.4, 9);
  });

  it('cuts the corner off: the box owns a point the rounded body does not', () => {
    const corner: [number, number] = [2.39, 0.94];
    expect(isInsideFootprint(corner, box)).toBe(true);
    expect(isInsideFootprint(corner, rounded)).toBe(false);
  });

  it('keeps the flat sides where they were', () => {
    expect(isInsideFootprint([2.39, 0], rounded)).toBe(true);
    expect(isInsideFootprint([0, 0.94], rounded)).toBe(true);
  });
});

describe('exit radius', () => {
  it('matches the old rectangle formula for a box', () => {
    for (const deg of [0, 17, 45, 90, 123, 180, -60]) {
      const a = (deg * Math.PI) / 180;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const old = Math.min(
        Math.abs(cos) < 1e-12 ? Infinity : 2.4 / Math.abs(cos),
        Math.abs(sin) < 1e-12 ? Infinity : 0.95 / Math.abs(sin),
      );
      expect(footprintExitRadius(cos, sin, box)).toBeCloseTo(old, 9);
    }
  });

  it('is the radius in every direction for a circular cylinder', () => {
    for (const deg of [0, 30, 45, 90, 200]) {
      const a = (deg * Math.PI) / 180;
      expect(footprintExitRadius(Math.cos(a), Math.sin(a), cylinder)).toBeCloseTo(2, 9);
    }
  });

  it('leaves the flat sides untouched but shortens the diagonal', () => {
    expect(footprintExitRadius(1, 0, rounded)).toBeCloseTo(2.4, 9);
    expect(footprintExitRadius(0, 1, rounded)).toBeCloseTo(0.95, 9);

    const d = Math.hypot(2.4, 0.95);
    const diag = footprintExitRadius(2.4 / d, 0.95 / d, rounded);
    expect(diag).toBeLessThan(d);
  });
});

describe('inside-body warning', () => {
  it('follows the shape, not just the bounding box', () => {
    const atCorner = { x: 2.35, y: 0.9, z: 0.8, yaw: 0, pitch: 0, roll: 0 };
    expect(isInsideBody(atCorner, box)).toBe(true);
    expect(isInsideBody(atCorner, rounded)).toBe(false);
  });

  it('still respects the height band', () => {
    const above = { x: 0, y: 0, z: 9, yaw: 0, pitch: 0, roll: 0 };
    expect(isInsideBody(above, rounded)).toBe(false);
  });
});

describe('snapping to a rounded body', () => {
  it('delegates to the box when there is no radius', () => {
    const p: [number, number, number] = [2.6, 0.5, 0.9];
    expect(nearestSurfacePointRounded(p, bodyBox(box), 0)).toEqual(
      nearestSurfacePoint(p, bodyBox(box)),
    );
  });

  it('puts a point on the flank of a cylinder at the radius, facing out', () => {
    const hit = snapToBody([2.1, 0, 0.9], cylinder)!;
    expect(hit).not.toBeNull();
    expect(Math.hypot(hit.position[0], hit.position[1])).toBeCloseTo(2, 9);
    expect(hit.normal[0]).toBeCloseTo(1, 9);
    expect(hit.normal[2]).toBeCloseTo(0, 9);
  });

  it('lands on the arc, not the old square corner', () => {
    // Within SNAP_DISTANCE of the arc — the old square corner reached further out than this.
    const hit = snapToBody([2.4, 0.9, 0.9], rounded);
    expect(hit).not.toBeNull();
    // On the outline, so its distance to the footprint is zero.
    expect(Math.abs(footprintDistance([hit!.position[0], hit!.position[1]], rounded))).toBeLessThan(
      1e-9,
    );
  });

  it('aims a roof mount straight up on any shape', () => {
    const hit = snapToBody([0, 0, 1.75], cylinder)!;
    expect(hit.normal).toEqual([0, 0, 1]);
  });

  it('pushes an interior point out through the nearest flank', () => {
    const hit = nearestSurfacePointRounded([1.5, 0, 0.9], bodyBox(cylinder), 2);
    expect(Math.hypot(hit.position[0], hit.position[1])).toBeCloseTo(2, 9);
    expect(hit.normal[0]).toBeCloseTo(1, 9);
  });

  it('still lets go beyond the snap distance', () => {
    expect(snapToBody([4, 0, 0.9], cylinder)).toBeNull();
  });
});
