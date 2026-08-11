import { describe, expect, it } from 'vitest';
import { DOM_DELTA_LINE, DOM_DELTA_PAGE, DOM_DELTA_PIXEL, wheelPixels } from '../wheel';

describe('wheel delta normalisation', () => {
  it('passes pixel deltas through untouched, as Chrome and Safari send them', () => {
    expect(wheelPixels(100, DOM_DELTA_PIXEL)).toBe(100);
    expect(wheelPixels(-53, DOM_DELTA_PIXEL)).toBe(-53);
  });

  it('puts one Firefox notch within a fifth of one Chrome notch', () => {
    const chrome = wheelPixels(100, DOM_DELTA_PIXEL);
    const firefox = wheelPixels(3, DOM_DELTA_LINE);
    expect(Math.abs(firefox - chrome) / chrome).toBeLessThan(0.2);
  });

  it('keeps the sign, so the zoom never inverts per browser', () => {
    expect(wheelPixels(-3, DOM_DELTA_LINE)).toBeLessThan(0);
    expect(wheelPixels(3, DOM_DELTA_LINE)).toBeGreaterThan(0);
  });

  it('scales pages far enough to stay a zoom rather than a nudge', () => {
    expect(wheelPixels(1, DOM_DELTA_PAGE)).toBeGreaterThan(wheelPixels(1, DOM_DELTA_LINE));
  });

  it('treats an unknown mode as pixels rather than dropping the gesture', () => {
    expect(wheelPixels(100, 99)).toBe(100);
  });

  it('is linear, so a fast flick scales like several slow notches', () => {
    expect(wheelPixels(9, DOM_DELTA_LINE)).toBeCloseTo(3 * wheelPixels(3, DOM_DELTA_LINE), 10);
  });
});
