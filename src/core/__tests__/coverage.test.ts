import { describe, expect, it } from 'vitest';
import { blindSpotReport, SECTOR_COUNT } from '../coverage';
import { frustum } from '../frustum';
import { groundPolygon } from '../ground';
import type { Pose, Vec2, Vehicle } from '../types';

const vehicle: Vehicle = {
  length: 4.8,
  width: 1.9,
  height: 1.5,
  clearance: 0.2,
  wheelbase: 2.8,
  wheelRadius: 0.34,
};

/** Four surround cameras on the roof centre, 100° each, covering the full azimuth. */
function surroundPolygons(yaws: number[]): Vec2[][] {
  return yaws
    .map((yaw) => {
      const pose: Pose = { x: 0, y: 0, z: 1, yaw, pitch: -25, roll: 0 };
      return groundPolygon(frustum(pose, { hfov: 100, vfov: 60, range: 30 }));
    })
    .filter((p): p is Vec2[] => p !== null);
}

describe('blind spot report', () => {
  it('reports every sector blind when there is no coverage at all', () => {
    const r = blindSpotReport([], vehicle);
    expect(r.sectors).toHaveLength(SECTOR_COUNT);
    expect(r.sectors.every((s) => !s.covered)).toBe(true);
    expect(r.blindFraction).toBe(1);
    expect(r.blind).toEqual([{ startDeg: -180, endDeg: 180 }]);
  });

  it('reports nothing blind for a full surround set', () => {
    const r = blindSpotReport(surroundPolygons([0, 90, 180, 270]), vehicle);
    expect(r.blind).toEqual([]);
    expect(r.blindFraction).toBe(0);
  });

  it('opens the forward sectors when the front sensor is removed', () => {
    const r = blindSpotReport(surroundPolygons([90, 180, 270]), vehicle);
    expect(r.blindFraction).toBeGreaterThan(0);

    const forward = r.sectors.find((s) => Math.abs(s.centerDeg) < 3)!;
    expect(forward.covered).toBe(false);

    const rear = r.sectors.find((s) => Math.abs(Math.abs(s.centerDeg) - 180) < 3)!;
    expect(rear.covered).toBe(true);
  });

  it('merges a rear gap into a single run across the ±180 seam', () => {
    const r = blindSpotReport(surroundPolygons([0, 90, 270]), vehicle);
    expect(r.blind).toHaveLength(1);
    expect(r.blind[0].endDeg).toBeGreaterThan(180);
    expect(r.blind[0].startDeg).toBeLessThan(180);
  });

  it('records how far out coverage starts', () => {
    const r = blindSpotReport(surroundPolygons([0, 90, 180, 270]), vehicle);
    for (const s of r.sectors) {
      expect(s.firstCoveredRadius).not.toBeNull();
      expect(s.firstCoveredRadius!).toBeGreaterThan(0);
    }
  });
});
