/**
 * Pointer and wheel handling for one pane, on the DOM rather than through the 3D event system.
 *
 * Screen-right and screen-up come from the pane's own camera basis, and every delta is divided
 * by the pane's pixels-per-metre, so a drag stays glued to the cursor at any zoom. Zooming is
 * anchored on the cursor in the pane the gesture started in.
 *
 * The TOP pane also drags sensors directly. Hit-testing is a projection rather than a raycast:
 * an orthographic pane maps world to pixels in two multiplications, so there is no reason to
 * involve the renderer.
 */

import { useEffect, useRef, type RefObject } from 'react';
import { yawPitchFromDirection } from '../core/rotation';
import { snapToBody } from '../core/snap';
import type { Vec3 } from '../core/types';
import type { ViewName } from '../core/viewport';
import { useStore, type OrthoViewState } from '../store/useStore';
import { gizmoHandleUnderPointer } from './gizmoHandle';
import { ORTHO_DEFS, isoMetresPerPixel, orthoPaneDeltaToWorld, orthoWorldToPane, type OrthoName } from './views';
import { wheelPixels } from './wheel';

const WHEEL_SENSITIVITY = 0.0015;
const ORBIT_DEG_PER_PIXEL = 0.35;
/** How close the pointer must be to a sensor marker to grab it, in pixels. */
const GRAB_RADIUS = 12;

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
    /** Set while a sensor is being dragged in the TOP pane. */
    let draggingSensor: string | null = null;

    /**
     * Nearest visible sensor marker to a pane-local point, within the grab radius.
     *
     * Only answers in Move mode: a sensor must never shift under a stray drag while the user is
     * reading the layout, so placing one is always a deliberate act.
     */
    const sensorUnder = (px: number, py: number): string | null => {
      if (name !== 'TOP') return null;
      const state = useStore.getState();
      if (state.dragMode !== 'translate') return null;
      const view = state.views.TOP;
      const rect = el.getBoundingClientRect();

      let best: string | null = null;
      let bestDistance = GRAB_RADIUS;
      for (const sensor of state.sensors) {
        if (!sensor.visible) continue;
        const p = orthoWorldToPane(
          [sensor.pose.x, sensor.pose.y, sensor.pose.z],
          ORTHO_DEFS.TOP,
          view,
          rect.width,
          rect.height,
        );
        const d = Math.hypot(p.x - px, p.y - py);
        if (d <= bestDistance) {
          bestDistance = d;
          best = sensor.id;
        }
      }
      return best;
    };

    /**
     * Moves a sensor by a pane-pixel delta, sticking it to the body when it lands close by.
     * Alt suppresses the snap.
     */
    const moveSensor = (id: string, dx: number, dy: number, altKey: boolean) => {
      const state = useStore.getState();
      const sensor = state.sensors.find((s) => s.id === id);
      if (!sensor) return;

      const delta = orthoPaneDeltaToWorld(dx, dy, ORTHO_DEFS.TOP, state.views.TOP.zoom);
      const target: Vec3 = [
        sensor.pose.x + delta[0],
        sensor.pose.y + delta[1],
        sensor.pose.z + delta[2],
      ];

      const hit = altKey ? null : snapToBody(target, state.vehicle);
      if (!hit) {
        state.updatePose(id, { x: target[0], y: target[1], z: target[2] });
        return;
      }

      const { yaw, pitch } = yawPitchFromDirection(hit.normal);
      state.updatePose(id, {
        x: hit.position[0],
        y: hit.position[1],
        z: hit.position[2],
        yaw,
        pitch,
      });
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const store = useStore.getState();
      const before = store.views[name];
      const factor = Math.exp(-wheelPixels(e.deltaY, e.deltaMode) * WHEEL_SENSITIVITY);
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
      // The gizmo shares this div. If a handle is under the pointer it owns the drag, not the orbit.
      if (name === 'ISO' && e.button === 0 && gizmoHandleUnderPointer()) return;
      const rect = el.getBoundingClientRect();
      const hit =
        e.button === 0 ? sensorUnder(e.clientX - rect.left, e.clientY - rect.top) : null;

      dragging = true;
      draggingSensor = hit;
      // The middle button always pans, in every pane — including ISO, where the left button
      // orbits. It never grabs a sensor either, so it stays a safe way to shift the view.
      panning = hit === null && (name !== 'ISO' || e.shiftKey || e.button === 1);
      lastX = e.clientX;
      lastY = e.clientY;
      if (hit) useStore.getState().select(hit);
      el.setPointerCapture(e.pointerId);
      el.style.cursor = hit ? 'grabbing' : panning ? 'grabbing' : 'move';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) {
        if (name === 'TOP') {
          const rect = el.getBoundingClientRect();
          el.style.cursor = sensorUnder(e.clientX - rect.left, e.clientY - rect.top)
            ? 'grab'
            : '';
        }
        return;
      }

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (dx === 0 && dy === 0) return;

      if (draggingSensor) {
        moveSensor(draggingSensor, dx, dy, e.altKey);
        return;
      }

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
        const elev = (iso.elevation * Math.PI) / 180;
        const right: Vec3 = [-Math.sin(az), Math.cos(az), 0];
        const up: Vec3 = [
          -Math.sin(elev) * Math.cos(az),
          -Math.sin(elev) * Math.sin(az),
          Math.cos(elev),
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
      draggingSensor = null;
      el.style.cursor = '';
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };

    const onDoubleClick = () => fitRef.current();
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    /**
     * Chrome opens its autoscroll widget on a middle press, which would hijack the pan. Only
     * `mousedown` suppresses it — cancelling `pointerdown` does not, since for a mouse pointer
     * the compatibility mouse event is dispatched regardless.
     */
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };
    const onAuxClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('auxclick', onAuxClick);
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('dblclick', onDoubleClick);
    el.addEventListener('contextmenu', onContextMenu);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('auxclick', onAuxClick);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endDrag);
      el.removeEventListener('pointercancel', endDrag);
      el.removeEventListener('dblclick', onDoubleClick);
      el.removeEventListener('contextmenu', onContextMenu);
    };
  }, [ref, name]);
}
