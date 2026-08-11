/**
 * Guards the sensor palette. The colour maths lives here rather than in the app because nothing
 * at runtime needs it — this is a constraint on a constant, checked once per test run.
 */

import { describe, expect, it } from 'vitest';
import { SENSOR_COLORS } from '../useStore';

const VIEWPORT_BG = '#F8FAFB';
/** Kept in step with `scene/BlindSectors.tsx`. */
const BLIND_SECTOR = '#BFBFBF';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

function luminance(c: number[]): number {
  const [r, g, b] = c.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

function lab(c: number[]): [number, number, number] {
  const [r, g, b] = c.map(toLinear);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
  const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
  const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** CIE76: coarse, but far more faithful than comparing hex strings. */
function deltaE(a: number[], b: number[]): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** What the eye sees once a layer is drawn at `alpha` over the viewport. */
const over = (hex: string, alpha: number) =>
  rgb(hex).map((c, i) => alpha * c + (1 - alpha) * rgb(VIEWPORT_BG)[i]);

function minPairwise(alpha: number): number {
  let min = Infinity;
  for (let i = 0; i < SENSOR_COLORS.length; i++) {
    for (let j = i + 1; j < SENSOR_COLORS.length; j++) {
      min = Math.min(min, deltaE(over(SENSOR_COLORS[i], alpha), over(SENSOR_COLORS[j], alpha)));
    }
  }
  return min;
}

describe('sensor palette', () => {
  it('offers twelve colours before the list wraps', () => {
    expect(SENSOR_COLORS).toHaveLength(12);
  });

  it('is all valid six-digit hex', () => {
    for (const c of SENSOR_COLORS) expect(c).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('has no duplicates', () => {
    expect(new Set(SENSOR_COLORS).size).toBe(SENSOR_COLORS.length);
  });

  it('keeps every pair apart as a solid, which is how the marker and axis draw', () => {
    expect(minPairwise(1)).toBeGreaterThan(15);
  });

  it('keeps every pair apart in the wireframe, which draws at 0.75', () => {
    expect(minPairwise(0.75)).toBeGreaterThan(12);
  });

  it('leaves the faintest volume fill still visible against the viewport', () => {
    const faintest = Math.min(
      ...SENSOR_COLORS.map((c) => deltaE(over(c, 0.3), rgb(VIEWPORT_BG))),
    );
    expect(faintest).toBeGreaterThan(8);
  });

  it('stays visible as a swatch dot on a white sidebar card', () => {
    for (const c of SENSOR_COLORS) {
      expect(contrast(rgb(c), [255, 255, 255])).toBeGreaterThanOrEqual(2.2);
    }
  });

  it('never reads as the blind-sector shading, which would turn a gap into coverage', () => {
    for (const c of SENSOR_COLORS) {
      expect(deltaE(rgb(c), rgb(BLIND_SECTOR))).toBeGreaterThan(25);
    }
  });

  it('stays pastel — nothing dark enough to read as interface chrome', () => {
    for (const c of SENSOR_COLORS) {
      const [l] = lab(rgb(c));
      expect(l).toBeGreaterThan(50);
      expect(l).toBeLessThan(80);
    }
  });
});
