import { describe, expect, it } from 'vitest';
import type { Pose } from '../../core/types';
import {
  FOOTPRINT_STEP,
  GROUND_LIFT,
  concatIndexed,
  fovBuffers,
  type IndexedGeometry,
} from '../fovGeometry';

function pose(p: Partial<Pose> = {}): Pose {
  return { x: 0, y: 0, z: 2, yaw: 0, pitch: -90, roll: 0, ...p };
}

const spec = { hfov: 90, vfov: 90, range: 10 };

describe('concatIndexed', () => {
  const a: IndexedGeometry = { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] };
  const b: IndexedGeometry = { positions: [5, 0, 0, 6, 0, 0, 5, 1, 0], indices: [0, 2, 1] };

  it('shifts each part past the vertices already placed', () => {
    const merged = concatIndexed([a, b]);
    expect(merged.positions).toEqual([...a.positions, ...b.positions]);
    expect(merged.indices).toEqual([0, 1, 2, 3, 5, 4]);
  });

  it('leaves every coordinate untouched, so a merged draw covers the same space', () => {
    const merged = concatIndexed([a, b]);
    for (let i = 0; i < a.positions.length; i++) {
      expect(merged.positions[i]).toBe(a.positions[i]);
    }
    for (let i = 0; i < b.positions.length; i++) {
      expect(merged.positions[a.positions.length + i]).toBe(b.positions[i]);
    }
  });

  it('keeps every triangle of every part', () => {
    const merged = concatIndexed([a, b, a]);
    expect(merged.indices).toHaveLength(9);
    expect(merged.positions).toHaveLength(27);
  });

  it('handles an empty list and empty parts', () => {
    expect(concatIndexed([])).toEqual({ positions: [], indices: [] });
    expect(concatIndexed([{ positions: [], indices: [] }, a])).toEqual(a);
  });

  it('never emits an index past the end of the buffer', () => {
    const merged = concatIndexed([a, b, a, b]);
    const vertexCount = merged.positions.length / 3;
    for (const i of merged.indices) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(vertexCount);
    }
  });
});

describe('fovBuffers', () => {
  it('indexes only vertices it actually emitted', () => {
    const b = fovBuffers(pose(), spec, 'axis');
    const vertexCount = b.positions.length / 3;
    for (const i of [...b.triangles, ...b.outline]) {
      expect(i).toBeLessThan(vertexCount);
    }
  });

  it('puts the footprint at the requested lift', () => {
    const b = fovBuffers(pose(), spec, 'axis');
    expect(b.footprint).not.toBeNull();
    for (let i = 2; i < b.footprint!.positions.length; i += 3) {
      expect(b.footprint!.positions[i]).toBe(GROUND_LIFT);
    }
  });

  it('accepts a lift of its own, which is how coplanar footprints are told apart', () => {
    const lift = GROUND_LIFT + 3 * FOOTPRINT_STEP;
    const b = fovBuffers(pose(), spec, 'axis', lift);
    for (let i = 2; i < b.footprint!.positions.length; i += 3) {
      expect(b.footprint!.positions[i]).toBe(lift);
    }
  });

  it('leaves the lift far below anything visible', () => {
    // Twenty sensors must not stack up into a step anyone could see on a 1 m grid.
    expect(20 * FOOTPRINT_STEP).toBeLessThan(0.005);
  });

  it('reports no footprint when the volume never reaches the ground', () => {
    const b = fovBuffers(pose({ pitch: 45 }), { hfov: 60, vfov: 30, range: 50 }, 'axis');
    expect(b.footprint).toBeNull();
  });

  it('gives the same volume geometry the merged draw will use', () => {
    // The merge must not re-derive the shape: one sensor merged is that sensor, exactly.
    const single = fovBuffers(pose(), spec, 'axis');
    const merged = concatIndexed([{ positions: single.positions, indices: single.triangles }]);
    expect(merged.positions).toEqual(single.positions);
    expect(merged.indices).toEqual(single.triangles);
  });
});
