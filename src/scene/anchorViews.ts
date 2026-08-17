/**
 * Keeps the drawing where it is when the viewport area changes width.
 *
 * Called with the change *before* it happens, so the cameras and the layout move in one step. The
 * first attempt at this corrected afterwards, from a ResizeObserver, and measured the cost: over a
 * five-step drag the vehicle's window x went 675, 672, 669, 675, 675 — every frame a step behind,
 * which is what a wobble is.
 */

import { VIEW_NAMES, paneCentreShifts, viewportRects } from '../core/viewport';
import { useStore } from '../store/useStore';
import { isoMetresPerPixel, isoScreenAxes } from './views';

/**
 * `from` and `to` are the viewport area's width before and after. Passed in rather than measured:
 * the caller knows both before the layout moves, and a measurement here would be a frame stale
 * again.
 */
export function anchorViewsForViewportGrowth(from: number, to: number, height: number): void {
  const growth = to - from;
  if (growth === 0 || from <= 0 || to <= 0 || height <= 0) return;
  const width = from;

  const store = useStore.getState();
  const shifts = paneCentreShifts(
    viewportRects(width, height, store.maximizedView),
    viewportRects(width + growth, height, store.maximizedView),
    // The area grows into the space the sidebar gives up, so its left edge moves the other way.
    -growth,
  );

  for (const name of VIEW_NAMES) {
    const { dx, dy } = shifts[name];
    if (dx === 0 && dy === 0) continue;

    if (name === 'ISO') {
      const iso = store.views.ISO;
      const mpp = isoMetresPerPixel(iso, height);
      const { right, up } = isoScreenAxes(iso);
      store.setIsoView({
        target: [
          iso.target[0] + right[0] * dx * mpp - up[0] * dy * mpp,
          iso.target[1] + right[1] * dx * mpp - up[1] * dy * mpp,
          iso.target[2] + right[2] * dx * mpp - up[2] * dy * mpp,
        ],
      });
    } else {
      const view = store.views[name];
      store.setOrthoView(name, {
        pan: [view.pan[0] + dx / view.zoom, view.pan[1] - dy / view.zoom],
      });
    }
  }
}
