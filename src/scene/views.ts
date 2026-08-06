/**
 * Camera definitions for the four panes, and the fit maths.
 *
 * The world is ISO 8855 straight through — +X forward, +Y left, +Z up — so every camera sets
 * its own up vector. Each orthographic pane has a fixed orientation, so its quaternion is built
 * once from its screen-right / screen-up / view-normal basis rather than by calling lookAt
 * every frame, which removes any chance of the up vector being applied in the wrong order.
 */

import * as THREE from 'three';
import { effectiveSpec } from '../core/catalog';
import { frustum } from '../core/frustum';
import { groundPolygon } from '../core/ground';
import type { SensorInstance, SensorSpec, Vec3, Vehicle } from '../core/types';
import type { ViewName } from '../core/viewport';
import type { IsoViewState, OrthoViewState } from '../store/useStore';

export type OrthoName = 'TOP' | 'FRONT' | 'LEFT';

/** Far enough that nothing in a plausible layout falls outside the ortho depth range. */
export const ORTHO_DISTANCE = 500;
export const ISO_FOV = 36;
/** Room left around the bounding box when fitting. */
export const FIT_MARGIN = 1.14;

export interface OrthoDef {
  /** Screen-right, screen-up and the direction from the target to the camera, in world space. */
  right: THREE.Vector3;
  up: THREE.Vector3;
  normal: THREE.Vector3;
  quaternion: THREE.Quaternion;
  axisHint: string;
}

function orthoDef(right: Vec3, up: Vec3, normal: Vec3, axisHint: string): OrthoDef {
  const r = new THREE.Vector3(...right);
  const u = new THREE.Vector3(...up);
  const n = new THREE.Vector3(...normal);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, n));
  return { right: r, up: u, normal: n, quaternion: q, axisHint };
}

export const ORTHO_DEFS: Record<OrthoName, OrthoDef> = {
  // Looking down from +Z with the nose up the screen, so the vehicle's right is screen-right.
  TOP: orthoDef([0, -1, 0], [1, 0, 0], [0, 0, 1], '+X up · +Y left'),
  // Looking aft from +X, so the vehicle's left is screen-right.
  FRONT: orthoDef([0, 1, 0], [0, 0, 1], [1, 0, 0], '+Y right · +Z up'),
  // Looking at the left flank from +Y, so the nose points screen-left.
  LEFT: orthoDef([-1, 0, 0], [0, 0, 1], [0, 1, 0], '+X left · +Z up'),
};

export const AXIS_HINTS: Record<ViewName, string> = {
  TOP: ORTHO_DEFS.TOP.axisHint,
  FRONT: ORTHO_DEFS.FRONT.axisHint,
  LEFT: ORTHO_DEFS.LEFT.axisHint,
  ISO: '+Z up · orbit',
};

/* ------------------------------------------------------------------------ ortho camera */

export function orthoCameraPosition(def: OrthoDef, view: OrthoViewState): THREE.Vector3 {
  return new THREE.Vector3()
    .addScaledVector(def.right, view.pan[0])
    .addScaledVector(def.up, view.pan[1])
    .addScaledVector(def.normal, ORTHO_DISTANCE);
}

/* -------------------------------------------------------------------------- iso camera */

const DEG = Math.PI / 180;

export function isoCameraPosition(view: IsoViewState): THREE.Vector3 {
  const el = view.elevation * DEG;
  const az = view.azimuth * DEG;
  const c = Math.cos(el) * view.distance;
  return new THREE.Vector3(
    view.target[0] + c * Math.cos(az),
    view.target[1] + c * Math.sin(az),
    view.target[2] + Math.sin(el) * view.distance,
  );
}

/** Orientation that looks from `position` at `target` with world +Z up. */
export function isoCameraQuaternion(position: THREE.Vector3, target: Vec3): THREE.Quaternion {
  const z = position.clone().sub(new THREE.Vector3(...target)).normalize();
  const worldUp = new THREE.Vector3(0, 0, 1);
  const x = new THREE.Vector3().crossVectors(worldUp, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** Metres per pixel at the orbit target, for shift-drag panning. */
export function isoMetresPerPixel(view: IsoViewState, paneHeight: number): number {
  if (paneHeight <= 0) return 0;
  return (2 * view.distance * Math.tan((ISO_FOV / 2) * DEG)) / paneHeight;
}

/* ------------------------------------------------------------------------ scene bounds */

/**
 * Every point that must stay on screen: the vehicle box, plus each visible sensor's frustum
 * and its ground footprint. Fitting to the frustum corners alone would clip a footprint that
 * runs past the far plane's projection.
 */
export function sceneBounds(
  vehicle: Vehicle,
  sensors: SensorInstance[],
  catalog: SensorSpec[],
): Vec3[] {
  const hl = vehicle.length / 2;
  const hw = vehicle.width / 2;
  const top = vehicle.clearance + vehicle.height;
  const points: Vec3[] = [];

  for (const sx of [-hl, hl]) {
    for (const sy of [-hw, hw]) {
      points.push([sx, sy, 0], [sx, sy, top]);
    }
  }

  for (const s of sensors) {
    if (!s.visible) continue;
    const f = frustum(s.pose, effectiveSpec(s, catalog));
    for (const v of f.vertices) points.push(v);
    const poly = groundPolygon(f);
    if (poly) for (const [x, y] of poly) points.push([x, y, 0]);
  }

  return points;
}

/* -------------------------------------------------------------------------- fitting */

export function fitOrtho(
  def: OrthoDef,
  points: Vec3[],
  paneWidth: number,
  paneHeight: number,
): OrthoViewState | null {
  if (points.length === 0 || paneWidth <= 0 || paneHeight <= 0) return null;

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;

  for (const p of points) {
    const u = p[0] * def.right.x + p[1] * def.right.y + p[2] * def.right.z;
    const v = p[0] * def.up.x + p[1] * def.up.y + p[2] * def.up.z;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }

  const spanU = Math.max(maxU - minU, 1e-3) * FIT_MARGIN;
  const spanV = Math.max(maxV - minV, 1e-3) * FIT_MARGIN;

  return {
    zoom: Math.min(paneWidth / spanU, paneHeight / spanV),
    pan: [(minU + maxU) / 2, (minV + maxV) / 2],
  };
}

export function fitIso(
  view: IsoViewState,
  points: Vec3[],
  paneWidth: number,
  paneHeight: number,
): IsoViewState | null {
  if (points.length === 0 || paneWidth <= 0 || paneHeight <= 0) return null;

  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points) {
    for (let i = 0; i < 3; i++) {
      if (p[i] < min[i]) min[i] = p[i];
      if (p[i] > max[i]) max[i] = p[i];
    }
  }
  const target: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];

  let radius = 0;
  for (const p of points) {
    const d = Math.hypot(p[0] - target[0], p[1] - target[1], p[2] - target[2]);
    if (d > radius) radius = d;
  }
  radius = Math.max(radius, 0.5);

  const vHalf = (ISO_FOV / 2) * DEG;
  const hHalf = Math.atan(Math.tan(vHalf) * (paneWidth / paneHeight));
  const distance = (radius / Math.sin(Math.min(vHalf, hHalf))) * FIT_MARGIN;

  return { ...view, target, distance };
}
