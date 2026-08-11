import { describe, expect, it } from 'vitest';
import { gridExtents } from '../GroundGrid';

describe('grid extents', () => {
  it('reproduces the original fixed extents at the 1 m default', () => {
    expect(gridExtents(1)).toEqual({ fineHalf: 25, majorStep: 10, coarseHalf: 100 });
  });

  it('shrinks its reach for a fine cell rather than drawing more lines', () => {
    const fine = gridExtents(0.1);
    expect(fine.fineHalf).toBeCloseTo(2.5, 10);
    expect(fine.majorStep).toBeCloseTo(1, 10);
    expect(fine.coarseHalf).toBeCloseTo(10, 10);
  });

  it('reaches further for a coarse cell', () => {
    expect(gridExtents(5)).toEqual({ fineHalf: 125, majorStep: 50, coarseHalf: 500 });
  });

  it('scales every extent linearly, so the line count never changes', () => {
    const a = gridExtents(0.25);
    const b = gridExtents(2.5);
    expect(b.fineHalf / a.fineHalf).toBeCloseTo(10, 10);
    expect(b.majorStep / a.majorStep).toBeCloseTo(10, 10);
    expect(b.coarseHalf / a.coarseHalf).toBeCloseTo(10, 10);
  });

  it('keeps the heavy line on a multiple of the cell', () => {
    for (const size of [0.01, 0.05, 0.5, 1, 3.75, 10]) {
      const { majorStep } = gridExtents(size);
      expect(majorStep / size).toBeCloseTo(10, 10);
    }
  });
});
