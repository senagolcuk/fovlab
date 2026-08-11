/**
 * Wheel deltas, in pixels, whatever unit the browser chose to report them in.
 *
 * `WheelEvent.deltaY` is only comparable across browsers once `deltaMode` is folded in. Chrome
 * and Safari report pixels (`DOM_DELTA_PIXEL`), roughly 100 per notch. Firefox reports lines
 * (`DOM_DELTA_LINE`) — 3 per notch — so reading `deltaY` raw makes one Firefox notch a thirtieth
 * of a Chrome one, and zooming feels broken rather than merely slow.
 */

export const DOM_DELTA_PIXEL = 0;
export const DOM_DELTA_LINE = 1;
export const DOM_DELTA_PAGE = 2;

/** Chrome sends ~100 px per notch, Firefox 3 lines: 33 px a line puts a notch at the same step. */
const PIXELS_PER_LINE = 33;
/** No desktop browser reports pages for a wheel, but the spec allows it. */
const PIXELS_PER_PAGE = 400;

export function wheelPixels(deltaY: number, deltaMode: number): number {
  switch (deltaMode) {
    case DOM_DELTA_LINE:
      return deltaY * PIXELS_PER_LINE;
    case DOM_DELTA_PAGE:
      return deltaY * PIXELS_PER_PAGE;
    default:
      return deltaY;
  }
}
