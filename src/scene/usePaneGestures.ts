/**
 * Pointer and wheel handling for one pane, on the DOM rather than through the 3D event system.
 *
 * Screen-right and screen-up come from the pane's own camera basis, and every delta is divided
 * by the pane's pixels-per-metre, so a drag stays glued to the cursor at any zoom. Zooming is
 * anchored on the cursor in the pane the gesture started in.
 */

import { useEffect, useRef, type RefObject } from 'react';
import type { ViewName } from '../core/viewport';
import { useStore, type OrthoViewState } from '../store/useStore';
import { isoMetresPerPixel, type OrthoName } from './views';

const WHEEL_SENSITIVITY = 0.0015;
const ORBIT_DEG_PER_PIXEL = 0.35;

export function usePaneGestures(
  ref: RefObject<HTMLElement | null>,
  name: ViewName,
  onFit: () => void,
) {
  const fitRef = useRef(onFit);
  fitRef.current = onFit;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let panning = false;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const store = useStore.getState();
      const before = store.views[name];
      const factor = Math.exp(-e.deltaY * WHEEL_SENSITIVITY);
      store.zoomBy(factor, name);

      if (name === 'ISO') return;

      // Keep the world point under the cursor where it is.
      const b = before as OrthoViewState;
      const after = useStore.getState().views[name] as OrthoViewState;
      if (after.zoom === b.zoom) return;

      const rect = el.getBoundingClientRect();
      const dx = e.clientX - rect.left - rect.width / 2;
      const dy = e.clientY - rect.top - rect.height / 2;
      const u = b.pan[0] + dx / b.zoom;
      const v = b.pan[1] - dy / b.zoom;
      useStore
        .getState()
        .setOrthoView(name as OrthoName, { pan: [u - dx / after.zoom, v + dy / after.zoom] });
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 1) return;
      dragging = true;
      panning = name !== 'ISO' || e.shiftKey;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = panning ? 'grabbing' : 'move';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (dx === 0 && dy === 0) return;

      const store = useStore.getState();

      if (name !== 'ISO') {
        const view = store.views[name] as OrthoViewState;
        store.setOrthoView(name as OrthoName, {
          pan: [view.pan[0] - dx / view.zoom, view.pan[1] + dy / view.zoom],
        });
        return;
      }

      const iso = store.views.ISO;
      if (panning) {
        const rect = el.getBoundingClientRect();
        const mpp = isoMetresPerPixel(iso, rect.height);
        const az = (iso.azimuth * Math.PI) / 180;
        const el_ = (iso.elevation * Math.PI) / 180;
        const right: [number, number, number] = [-Math.sin(az), Math.cos(az), 0];
        const up: [number, number, number] = [
          -Math.sin(el_) * Math.cos(az),
          -Math.sin(el_) * Math.sin(az),
          Math.cos(el_),
        ];
        store.setIsoView({
          target: [
            iso.target[0] - right[0] * dx * mpp + up[0] * dy * mpp,
            iso.target[1] - right[1] * dx * mpp + up[1] * dy * mpp,
            iso.target[2] - right[2] * dx * mpp + up[2] * dy * mpp,
          ],
        });
      } else {
        store.setIsoView({
          azimuth: iso.azimuth - dx * ORBIT_DEG_PER_PIXEL,
          elevation: iso.elevation + dy * ORBIT_DEG_PER_PIXEL,
        });
      }
    };

    const endDrag = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = '';
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };

    const onDoubleClick = () => fitRef.current();
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('dblclick', onDoubleClick);
    el.addEventListener('contextmenu', onContextMenu);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endDrag);
      el.removeEventListener('pointercancel', endDrag);
      el.removeEventListener('dblclick', onDoubleClick);
      el.removeEventListener('contextmenu', onContextMenu);
    };
  }, [ref, name]);
}
