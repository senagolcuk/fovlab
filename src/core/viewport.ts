/**
 * Viewport tiling. Pure arithmetic so the layout is testable without a DOM.
 *
 *   TOP   | FRONT
 *   ------+------
 *   LEFT  | ISO
 *
 * Rects are CSS pixels with the origin at the top-left of the viewport area. Widths are
 * distributed so the four rects tile the area exactly: no gap, no overlap, no rounding drift.
 */

import type { Rect } from './types';

export type ViewName = 'TOP' | 'FRONT' | 'LEFT' | 'ISO';
export const VIEW_NAMES: ViewName[] = ['TOP', 'FRONT', 'LEFT', 'ISO'];

export function viewportRects(width: number, height: number): Record<ViewName, Rect> {
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
