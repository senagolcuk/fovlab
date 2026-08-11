/**
 * Whether a gizmo handle currently sits under the pointer.
 *
 * `TransformControls` and the ISO pane's own orbit gesture listen on the same div, so on
 * pointerdown exactly one of them has to win. `TransformControls` sets `axis` during its hover
 * pass on the preceding pointermove, so reading it here decides the question without depending
 * on the order the two listeners happened to be registered in.
 */

interface GizmoControls {
  axis: string | null;
  dragging: boolean;
}

let controls: GizmoControls | null = null;

export function registerGizmoControls(next: GizmoControls | null) {
  controls = next;
}

/** True while a handle is hovered or being dragged — the orbit must stand down. */
export function gizmoHandleUnderPointer(): boolean {
  return controls !== null && (controls.axis !== null || controls.dragging);
}
