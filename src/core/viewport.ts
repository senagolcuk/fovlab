/**
 * Viewport tiling. Pure arithmetic so the layout is testable without a DOM.
 *
 *   TOP   | FRONT
 *   ------+------
 *   LEFT  | ISO
 *
 * Rects are CSS pixels with the origin at the top-left of the viewport area. Widths are
 * distributed so the four rects tile the area exactly: no gap, no overlap, no rounding drift.
 *
 * One pane can be maximised, in which case it takes the whole area and the other three come back
 * empty rather than absent — the caller still gets a rect for every view, and an empty one is the
 * signal not to mount that pane at all.
 */

import type { Rect } from './types';

export type ViewName = 'TOP' | 'FRONT' | 'LEFT' | 'ISO';
export const VIEW_NAMES: ViewName[] = ['TOP', 'FRONT', 'LEFT', 'ISO'];

export const EMPTY_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 };

export function viewportRects(
  width: number,
  height: number,
  maximized: ViewName | null = null,
): Record<ViewName, Rect> {
  if (maximized) {
    const rects = {
      TOP: EMPTY_RECT,
      FRONT: EMPTY_RECT,
      LEFT: EMPTY_RECT,
      ISO: EMPTY_RECT,
    };
    return { ...rects, [maximized]: { x: 0, y: 0, width, height } };
  }

  const leftW = Math.floor(width / 2);
  const rightW = width - leftW;
  const topH = Math.floor(height / 2);
  const bottomH = height - topH;

  return {
    TOP: { x: 0, y: 0, width: leftW, height: topH },
    FRONT: { x: leftW, y: 0, width: rightW, height: topH },
    LEFT: { x: 0, y: topH, width: leftW, height: bottomH },
    ISO: { x: leftW, y: topH, width: rightW, height: bottomH },
  };
}

/**
 * How much bigger a pane gets when it is maximised, as a scale factor.
 *
 * Used to grow the drawing by the same amount, so a maximised pane shows the same *fraction* of
 * itself filled as the tiled one did — the picture comes closer rather than the extra room simply
 * appearing around it. The limiting dimension wins, for the same reason a fit uses it: scaling by
 * the more generous one would push the content off the other edge.
 */
export function paneGrowth(width: number, height: number, name: ViewName): number {
  const tiled = viewportRects(width, height)[name];
  if (tiled.width <= 0 || tiled.height <= 0) return 1;
  return Math.min(width / tiled.width, height / tiled.height);
}
