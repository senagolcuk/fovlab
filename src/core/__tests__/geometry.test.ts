/**
 * The acceptance tests from `03-geometry.md`. These must pass at all times.
 * Tolerance 1e-4.
 */

import { describe, expect, it } from 'vitest';
import { applyMat3, multiplyMat3, rotationMatrix, transpose } from '../rotation';
import { frustum } from '../frustum';
import { groundPolygon, polygonArea, polygonExtents } from '../ground';
import { EMPTY_RECT, viewportRects, VIEW_NAMES } from '../viewport';
import type { Pose, Vec3 } from '../types';

const TOL = 1e-4;

function pose(p: Partial<Pose>): Pose {
  return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, ...p };
}

function expectVec3(actual: Vec3, expected: Vec3) {
  expect(actual[0]).toBeCloseTo(expected[0], 4);
  expect(actual[1]).toBeCloseTo(expected[1], 4);
  expect(actual[2]).toBeCloseTo(expected[2], 4);
}

const X: Vec3 = [1, 0, 0];

describe('acceptance', () => {
  it('1 — identity rotation leaves the optical axis alone', () => {
    expectVec3(applyMat3(rotationMatrix(0, 0, 0), X), [1, 0, 0]);
  });

  it('2 — yaw + turns left', () => {
    expectVec3(applyMat3(rotationMatrix(90, 0, 0), X), [0, 1, 0]);
  });

  it('3 — pitch − points down', () => {
    expectVec3(applyMat3(rotationMatrix(0, -30, 0), X), [0.8660254, 0, -0.5]);
  });

  it('4 — pitch + points up', () => {
    expectVec3(applyMat3(rotationMatrix(0, 30, 0), X), [0.8660254, 0, 0.5]);
  });

  it('5 — yaw 180 with pitch −20', () => {
    expectVec3(applyMat3(rotationMatrix(180, -20, 0), X), [-0.9396926, 0, -0.3420201]);
  });

  it('6 — R is orthonormal for any pose', () => {
    let seed = 20240501;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    for (let n = 0; n < 48; n++) {
      const yaw = rand() * 720 - 360;
      const pitch = rand() * 180 - 90;
      const roll = rand() * 720 - 360;
      const R = rotationMatrix(yaw, pitch, roll);
      const I = multiplyMat3(transpose(R), R);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          expect(I[r][c]).toBeCloseTo(r === c ? 1 : 0, 10);
        }
      }
    }
  });

  it('7 — straight down at z = 2, 90°×90°, gives a 4 m square of area 16', () => {
    const f = frustum(pose({ z: 2, pitch: -90 }), { hfov: 90, vfov: 90, range: 10 });
    const poly = groundPolygon(f);
    expect(poly).not.toBeNull();
    expect(poly!).toHaveLength(4);

    const { x, y } = polygonExtents(poly!);
    expect(x[0]).toBeCloseTo(-2, 4);
    expect(x[1]).toBeCloseTo(2, 4);
    expect(y[0]).toBeCloseTo(-2, 4);
    expect(y[1]).toBeCloseTo(2, 4);
    expect(polygonArea(poly!)).toBeCloseTo(16, 4);

    for (const p of poly!) {
      expect(Math.abs(Math.abs(p[0]) - 2)).toBeLessThan(TOL);
      expect(Math.abs(Math.abs(p[1]) - 2)).toBeLessThan(TOL);
    }
  });

  it('8 — pitch −45 at z = 2, hfov 60 / vfov 90, puts the near edge at x = 0, y = ±0.8165', () => {
    const f = frustum(pose({ z: 2, pitch: -45 }), { hfov: 60, vfov: 90, range: 500 });
    const poly = groundPolygon(f)!;
    expect(poly).not.toBeNull();

    const minX = Math.min(...poly.map((p) => p[0]));
    expect(minX).toBeCloseTo(0, 4);

    const nearY = poly.filter((p) => Math.abs(p[0] - minX) < TOL).map((p) => p[1]);
    expect(nearY).toHaveLength(2);
    expect(Math.max(...nearY)).toBeCloseTo(0.8164966, 4);
    expect(Math.min(...nearY)).toBeCloseTo(-0.8164966, 4);
  });

  it('9 — level at z = 1 with 90°×90° puts the near edge at x = 1', () => {
    const f = frustum(pose({ z: 1, pitch: 0 }), { hfov: 90, vfov: 90, range: 20 });
    const poly = groundPolygon(f)!;
    expect(poly).not.toBeNull();
    expect(Math.min(...poly.map((p) => p[0]))).toBeCloseTo(1, 4);
  });

  it('10 — the four viewports tile an odd canvas with no gap and no overlap', () => {
    const W = 1601;
    const H = 901;
    const rects = viewportRects(W, H);
    const list = VIEW_NAMES.map((n) => rects[n]);

    for (const r of list) {
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(W);
      expect(r.y + r.height).toBeLessThanOrEqual(H);
      expect(Number.isInteger(r.x + r.y + r.width + r.height)).toBe(true);
    }

    // No overlap.
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const ox = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
        const oy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
        expect(ox * oy).toBe(0);
      }
    }

    // No gap: with no overlap, matching total area means the union is exactly the canvas.
    expect(list.reduce((s, r) => s + r.width * r.height, 0)).toBe(W * H);
  });

  it('10b — a maximised pane takes the whole canvas and the rest come back empty', () => {
    const W = 1601;
    const H = 901;

    for (const name of VIEW_NAMES) {
      const rects = viewportRects(W, H, name);
      expect(rects[name]).toEqual({ x: 0, y: 0, width: W, height: H });
      for (const other of VIEW_NAMES) {
        if (other === name) continue;
        expect(rects[other]).toEqual(EMPTY_RECT);
      }
      // Still exactly the canvas, so nothing is drawn twice or left blank.
      expect(VIEW_NAMES.reduce((sum, n) => sum + rects[n].width * rects[n].height, 0)).toBe(W * H);
    }
  });

  it('10c — no maximised pane is the tiling it always was', () => {
    expect(viewportRects(1601, 901, null)).toEqual(viewportRects(1601, 901));
  });
});
