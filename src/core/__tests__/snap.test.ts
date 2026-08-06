import { describe, expect, it } from 'vitest';
import { anglesFromMatrix, applyMat3, rotationMatrix, yawPitchFromDirection } from '../rotation';
import { SNAP_DISTANCE, bodyBox, nearestSurfacePoint, snapToBody } from '../snap';
import type { Vec3, Vehicle } from '../types';

const vehicle: Vehicle = {
  length: 4.8,
  width: 1.9,
  height: 1.5,
  clearance: 0.2,
  wheelbase: 2.8,
  wheelRadius: 0.34,
};
// box: x ±2.4, y ±0.95, z 0.2 … 1.7

describe('nearestSurfacePoint', () => {
  const box = bodyBox(vehicle);

  it('projects a point just ahead of the bumper onto the front face', () => {
    const hit = nearestSurfacePoint([2.5, 0, 1], box);
    expect(hit.position).toEqual([2.4, 0, 1]);
    expect(hit.normal).toEqual([1, 0, 0]);
    expect(hit.distance).toBeCloseTo(0.1, 9);
  });

  it('projects a point beside the flank onto the side face', () => {
    const hit = nearestSurfacePoint([0, 1.05, 1], box);
    expect(hit.position).toEqual([0, 0.95, 1]);
    expect(hit.normal).toEqual([0, 1, 0]);
  });

  it('projects a point above the roof onto the roof', () => {
    const hit = nearestSurfacePoint([0, 0, 1.8], box);
    expect(hit.position).toEqual([0, 0, 1.7]);
    expect(hit.normal).toEqual([0, 0, 1]);
  });

  it('gives a diagonal normal off a corner', () => {
    const hit = nearestSurfacePoint([2.5, 1.05, 1], box);
    expect(hit.position).toEqual([2.4, 0.95, 1]);
    expect(hit.normal[0]).toBeCloseTo(Math.SQRT1_2, 9);
    expect(hit.normal[1]).toBeCloseTo(Math.SQRT1_2, 9);
    expect(hit.normal[2]).toBeCloseTo(0, 9);
  });

  it('pushes an interior point out through the nearest panel', () => {
    // 0.1 m inside the front face, further from every other one.
    const hit = nearestSurfacePoint([2.3, 0, 1], box);
    expect(hit.position).toEqual([2.4, 0, 1]);
    expect(hit.normal).toEqual([1, 0, 0]);
    expect(hit.distance).toBeCloseTo(0.1, 9);
  });

  it('has a defined normal for a point exactly on a face', () => {
    const hit = nearestSurfacePoint([2.4, 0, 1], box);
    expect(hit.normal).toEqual([1, 0, 0]);
    expect(hit.distance).toBeCloseTo(0, 9);
  });
});

describe('snapToBody', () => {
  it('sticks within the snap distance', () => {
    expect(snapToBody([2.4 + SNAP_DISTANCE - 0.01, 0, 1], vehicle)).not.toBeNull();
  });

  it('lets go beyond it', () => {
    expect(snapToBody([2.4 + SNAP_DISTANCE + 0.01, 0, 1], vehicle)).toBeNull();
  });

  it('aims the optical axis out of the face it landed on', () => {
    const hit = snapToBody([0, 1.0, 1], vehicle)!;
    const { yaw, pitch } = yawPitchFromDirection(hit.normal);
    const axis = applyMat3(rotationMatrix(yaw, pitch, 0), [1, 0, 0]);
    expect(axis[0]).toBeCloseTo(hit.normal[0], 9);
    expect(axis[1]).toBeCloseTo(hit.normal[1], 9);
    expect(axis[2]).toBeCloseTo(hit.normal[2], 9);
    expect(yaw).toBeCloseTo(90, 9); // the left flank looks left
  });

  it('aims straight up off the roof', () => {
    const hit = snapToBody([0, 0, 1.75], vehicle)!;
    expect(yawPitchFromDirection(hit.normal).pitch).toBeCloseTo(90, 9);
  });
});

describe('anglesFromMatrix', () => {
  const cases: Array<[number, number, number]> = [
    [0, 0, 0],
    [45, -10, 0],
    [-135, 20, 15],
    [179, -75, -160],
    [90, 0, 90],
    [-30, 60, 120],
  ];

  it('round-trips through rotationMatrix', () => {
    for (const [yaw, pitch, roll] of cases) {
      const back = anglesFromMatrix(rotationMatrix(yaw, pitch, roll));
      const rebuilt = rotationMatrix(back.yaw, back.pitch, back.roll);
      const original = rotationMatrix(yaw, pitch, roll);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          expect(rebuilt[r][c]).toBeCloseTo(original[r][c], 9);
        }
      }
    }
  });

  it('reports a straight-down axis as pitch −90 with no roll', () => {
    const back = anglesFromMatrix(rotationMatrix(0, -90, 0));
    expect(back.pitch).toBeCloseTo(-90, 6);
    expect(back.roll).toBe(0);
  });

  it('folds roll into yaw at the vertical singularity', () => {
    // yaw 20 with roll 35 and pitch −90 is the same orientation as some yaw with roll 0.
    const original = rotationMatrix(20, -90, 35);
    const back = anglesFromMatrix(original);
    expect(back.roll).toBe(0);
    const rebuilt = rotationMatrix(back.yaw, back.pitch, back.roll);
    const axis: Vec3 = applyMat3(rebuilt, [1, 0, 0]);
    expect(axis[2]).toBeCloseTo(-1, 6);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        expect(rebuilt[r][c]).toBeCloseTo(original[r][c], 6);
      }
    }
  });
});
