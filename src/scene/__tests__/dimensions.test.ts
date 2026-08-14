/**
 * A dimension has to be measured in the plane its pane actually shows. Put the height on TOP and
 * it collapses to a point: two ends, same pixel, no line and a label over nothing.
 */

import { describe, expect, it } from 'vitest';
import type { Vec3, Vehicle } from '../../core/types';
import { DEFAULT_VEHICLE } from '../../store/persist';
import { dimensionsFor } from '../DimensionOverlay';
import { ORTHO_DEFS, type OrthoName } from '../views';

const PANES: OrthoName[] = ['TOP', 'FRONT', 'LEFT'];

/** Extent of a segment in a pane's own screen basis, in metres. */
function extentInPane(name: OrthoName, from: Vec3, to: Vec3) {
  const { right, up } = ORTHO_DEFS[name];
  const d: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  return Math.hypot(
    d[0] * right.x + d[1] * right.y + d[2] * right.z,
    d[0] * up.x + d[1] * up.y + d[2] * up.z,
  );
}

describe('vehicle dimension annotations', () => {
  it('gives every orthographic pane something to show', () => {
    for (const name of PANES) {
      expect(dimensionsFor(name, DEFAULT_VEHICLE).length).toBeGreaterThan(0);
    }
  });

  it('never measures along the direction a pane looks down', () => {
    for (const name of PANES) {
      for (const dim of dimensionsFor(name, DEFAULT_VEHICLE)) {
        expect(extentInPane(name, dim.from, dim.to)).toBeGreaterThan(0.01);
      }
    }
  });

  it('labels each dimension with the figure it measures', () => {
    const v = { ...DEFAULT_VEHICLE, length: 6.25, width: 2.1, height: 2.4 };
    const labels = PANES.flatMap((n) => dimensionsFor(n, v).map((d) => d.label));
    expect(labels).toContain('6.25 m');
    expect(labels).toContain('2.10 m');
    expect(labels).toContain('2.40 m');
  });

  it('shows every vehicle figure on at least one pane', () => {
    const v: Vehicle = {
      length: 6.25,
      width: 2.1,
      height: 2.4,
      clearance: 0.35,
      wheelbase: 3.9,
      wheelRadius: 0.4,
      shape: 'box',
      model: 'bus',
      cornerRadius: 0,
    };
    const labels = new Set(PANES.flatMap((n) => dimensionsFor(n, v).map((d) => d.label)));
    for (const figure of [v.length, v.width, v.height, v.clearance, v.wheelbase]) {
      expect(labels).toContain(`${figure.toFixed(2)} m`);
    }
  });

  it('keeps two dimensions on one pane off the same lane and side', () => {
    for (const name of PANES) {
      const dims = dimensionsFor(name, DEFAULT_VEHICLE);
      const seen = new Set<string>();
      for (const d of dims) {
        // Two parallel dimensions sharing a lane would be drawn on top of each other.
        const dir: Vec3 = [d.to[0] - d.from[0], d.to[1] - d.from[1], d.to[2] - d.from[2]];
        const axis = dir.findIndex((c) => Math.abs(c) > 1e-6);
        const key = `${axis}:${d.lane}:${d.flip ? 'f' : 'n'}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
});
