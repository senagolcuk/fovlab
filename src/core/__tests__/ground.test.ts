import { describe, expect, it } from 'vitest';
import { frustum } from '../frustum';
import {
  blindGap,
  groundCoverage,
  groundPolygon,
  isInsideBody,
  pointInPolygon,
  polygonArea,
  segmentToSegmentDistance,
} from '../ground';
import type { Pose, Vec2, Vehicle } from '../types';

const vehicle: Vehicle = {
  length: 4.8,
  width: 1.9,
  height: 1.5,
  clearance: 0.2,
  wheelbase: 2.8,
  wheelRadius: 0.34,
  shape: 'box',
  cornerRadius: 0,
};

function pose(p: Partial<Pose>): Pose {
  return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, ...p };
}

describe('ground polygon', () => {
  it('returns null when the frustum never reaches the ground', () => {
    const f = frustum(pose({ z: 2, pitch: 45 }), { hfov: 60, vfov: 30, range: 50 });
    expect(groundPolygon(f)).toBeNull();
  });

  it('returns null for a sensor below the ground looking down', () => {
    const f = frustum(pose({ z: -1, pitch: -90 }), { hfov: 90, vfov: 90, range: 10 });
    expect(groundPolygon(f)).toBeNull();
  });

  it('still sections the plane for a sensor below the ground looking up', () => {
    const f = frustum(pose({ z: -1, pitch: 90 }), { hfov: 90, vfov: 90, range: 10 });
    expect(polygonArea(groundPolygon(f)!)).toBeCloseTo(4, 6);
  });

  it('is unaffected by a 90° roll on a straight-down sensor, up to vertex order', () => {
    const spec = { hfov: 90, vfov: 90, range: 10 };
    const a = polygonArea(groundPolygon(frustum(pose({ z: 2, pitch: -90 }), spec))!);
    const b = polygonArea(groundPolygon(frustum(pose({ z: 2, pitch: -90, roll: 90 }), spec))!);
    expect(b).toBeCloseTo(a, 6);
  });

  it('yaw rotates the footprint about the sensor without changing its area', () => {
    const spec = { hfov: 70, vfov: 50, range: 30 };
    const a = polygonArea(groundPolygon(frustum(pose({ z: 1.2, pitch: -20 }), spec))!);
    const b = polygonArea(
      groundPolygon(frustum(pose({ z: 1.2, pitch: -20, yaw: 37 }), spec))!,
    );
    expect(b).toBeCloseTo(a, 6);
  });

  it('winds counter-clockwise so the area is positive', () => {
    const poly = groundPolygon(frustum(pose({ z: 2, pitch: -90 }), { hfov: 90, vfov: 90, range: 10 }))!;
    let signed = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      signed += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    }
    expect(signed).toBeGreaterThan(0);
  });
});

describe('blind gap', () => {
  const square = (x0: number, x1: number, y0: number, y1: number): Vec2[] => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];

  it('is the closed-form distance to the footprint', () => {
    // Footprint reaches x = 2.4; the polygon starts at x = 10.
    expect(blindGap(square(10, 14, -2, 2), vehicle)).toBeCloseTo(7.6, 9);
  });

  it('is zero when the polygon overlaps the footprint', () => {
    expect(blindGap(square(-1, 1, -1, 1), vehicle)).toBe(0);
  });

  it('is zero when the polygon swallows the footprint whole', () => {
    expect(blindGap(square(-50, 50, -50, 50), vehicle)).toBe(0);
  });

  it('is zero when the polygon just touches the footprint corner', () => {
    expect(blindGap(square(2.4, 6, 0.95, 4), vehicle)).toBe(0);
  });

  it('does not drift with a large footprint — the old sampled version did', () => {
    const big: Vehicle = { ...vehicle, length: 400, width: 200 };
    // Footprint reaches x = 200; the polygon starts at x = 260.
    expect(blindGap(square(260, 264, -2, 2), big)).toBeCloseTo(60, 9);
  });

  it('measures diagonally when the polygon sits off a corner', () => {
    const poly = square(6.4, 8, 3.95, 5); // 4 m forward, 3 m left of the corner
    expect(blindGap(poly, vehicle)).toBeCloseTo(5, 9);
  });
});

describe('segment distance', () => {
  it('is zero for crossing segments', () => {
    expect(segmentToSegmentDistance([-1, 0], [1, 0], [0, -1], [0, 1])).toBe(0);
  });

  it('is the perpendicular distance for parallel segments', () => {
    expect(segmentToSegmentDistance([0, 0], [4, 0], [0, 3], [4, 3])).toBeCloseTo(3, 9);
  });

  it('is the endpoint distance for skewed, non-overlapping segments', () => {
    expect(segmentToSegmentDistance([0, 0], [1, 0], [4, 0], [5, 0])).toBeCloseTo(3, 9);
  });
});

describe('point in polygon', () => {
  const tri: Vec2[] = [
    [0, 0],
    [4, 0],
    [0, 4],
  ];
  it('accepts an interior point', () => expect(pointInPolygon([1, 1], tri)).toBe(true));
  it('rejects an exterior point', () => expect(pointInPolygon([3, 3], tri)).toBe(false));
});

describe('body warning', () => {
  it('fires for a sensor inside the box', () => {
    expect(isInsideBody(pose({ x: 0, y: 0, z: 1 }), vehicle)).toBe(true);
  });
  it('stays quiet for a roof-mounted sensor', () => {
    expect(isInsideBody(pose({ x: 0, y: 0, z: 1.8 }), vehicle)).toBe(false);
  });
  it('stays quiet for a sensor under the bumper line but ahead of the box', () => {
    expect(isInsideBody(pose({ x: 2.5, y: 0, z: 0.5 }), vehicle)).toBe(false);
  });
});

describe('groundCoverage', () => {
  it('reports null readouts when there is no polygon', () => {
    const f = frustum(pose({ z: 2, pitch: 60 }), { hfov: 60, vfov: 30, range: 50 });
    const cov = groundCoverage(f, vehicle);
    expect(cov.polygon).toBeNull();
    expect(cov.area).toBe(0);
    expect(cov.blindGap).toBeNull();
  });

  it('reports area, extents and gap together', () => {
    const f = frustum(pose({ x: 2.4, z: 0.5, pitch: -10 }), { hfov: 120, vfov: 30, range: 40 });
    const cov = groundCoverage(f, vehicle);
    expect(cov.polygon).not.toBeNull();
    expect(cov.area).toBeGreaterThan(0);
    expect(cov.extentX![0]).toBeGreaterThan(2.4);
    expect(cov.blindGap).toBeGreaterThanOrEqual(0);
  });
});
