/**
 * Hands the canvas the pointer only when the gizmo actually needs it.
 *
 * The panes are DOM divs under a canvas that is `pointer-events: none`, which is what lets each
 * pane own its own pan, zoom and orbit. `TransformControls` listens on the canvas, so it would
 * never see a thing. Rather than choosing between the two, this enables canvas events only
 * while the cursor is inside the ISO pane and close to the selected sensor — so orbiting still
 * works everywhere else in that pane — and keeps them on for the duration of a gizmo drag.
 */

import { useEffect, type RefObject } from 'react';
import type { Rect } from '../core/types';
import { useStore } from '../store/useStore';
import { projectToIsoPane } from './views';

/** Roughly the on-screen reach of the gizmo handles, in pixels. */
export const GIZMO_REACH = 130;

export function useCanvasPointerGate(hostRef: RefObject<HTMLElement | null>, isoRect: Rect) {
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = host.querySelector('canvas');
    if (!canvas) return;

    const setEvents = (on: boolean) => {
      const want = on ? 'auto' : 'none';
      if (canvas.style.pointerEvents !== want) canvas.style.pointerEvents = want;
    };

    const onMove = (e: PointerEvent) => {
      const state = useStore.getState();
      if (state.gizmoDragging) {
        setEvents(true);
        return;
      }

      const sensor = state.sensors.find((s) => s.id === state.selectedId);
      if (state.dragMode === 'off' || !sensor || !sensor.visible) {
        setEvents(false);
        return;
      }

      const hostRect = host.getBoundingClientRect();
      const px = e.clientX - hostRect.left - isoRect.x;
      const py = e.clientY - hostRect.top - isoRect.y;
      if (px < 0 || py < 0 || px > isoRect.width || py > isoRect.height) {
        setEvents(false);
        return;
      }

      const projected = projectToIsoPane(
        [sensor.pose.x, sensor.pose.y, sensor.pose.z],
        state.views.ISO,
        isoRect.width,
        isoRect.height,
      );
      setEvents(
        projected !== null && Math.hypot(projected.x - px, projected.y - py) <= GIZMO_REACH,
      );
    };

    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', () => setEvents(false));
    return () => {
      host.removeEventListener('pointermove', onMove);
      setEvents(false);
    };
  }, [hostRef, isoRect.x, isoRect.y, isoRect.width, isoRect.height]);
}
