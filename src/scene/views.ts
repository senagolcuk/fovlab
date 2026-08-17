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
/**
 * Room left around the content when fitting.
 *
 * One value for every pane, and a small one. The wide margin was there so a layout would not sit
 * pinned to the frame, and centring on the vehicle already guarantees that on three sides — only
 * the longest reach can approach an edge. Keeping the old 1.14 as well would have taken another
 * eighth off a framing that symmetry has already made smaller.
 */
export const FIT_MARGIN = 1.04;

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

/**
 * The ISO pane's screen-right and screen-up directions, in world space.
 *
 * Derived from the orbit angles rather than read off the camera, so it is available to anything
 * that has the view state — the pan gesture and the resize anchor both need it, and two copies of
 * this would drift.
 */
export function isoScreenAxes(view: IsoViewState): { right: Vec3; up: Vec3 } {
  const az = view.azimuth * DEG;
  const el = view.elevation * DEG;
  return {
    right: [-Math.sin(az), Math.cos(az), 0],
    up: [-Math.sin(el) * Math.cos(az), -Math.sin(el) * Math.sin(az), Math.cos(el)],
  };
}

/** Metres per pixel at the orbit target, for shift-drag panning. */
export function isoMetresPerPixel(view: IsoViewState, paneHeight: number): number {
  if (paneHeight <= 0) return 0;
  return (2 * view.distance * Math.tan((ISO_FOV / 2) * DEG)) / paneHeight;
}

/* --------------------------------------------------------------------------- projection */

/**
 * World point to pane pixels, for an orthographic pane. Used to hit-test sensor markers and
 * to place the gizmo proximity zone without going near the 3D event system.
 */
export function orthoWorldToPane(
  p: Vec3,
  def: OrthoDef,
  view: OrthoViewState,
  paneWidth: number,
  paneHeight: number,
): { x: number; y: number } {
  const u = p[0] * def.right.x + p[1] * def.right.y + p[2] * def.right.z;
  const v = p[0] * def.up.x + p[1] * def.up.y + p[2] * def.up.z;
  return {
    x: (u - view.pan[0]) * view.zoom + paneWidth / 2,
    y: paneHeight / 2 - (v - view.pan[1]) * view.zoom,
  };
}

/** A pointer delta in pane pixels, as a world displacement in that pane's plane. */
export function orthoPaneDeltaToWorld(dx: number, dy: number, def: OrthoDef, zoom: number): Vec3 {
  const du = dx / zoom;
  const dv = -dy / zoom;
  return [
    def.right.x * du + def.up.x * dv,
    def.right.y * du + def.up.y * dv,
    def.right.z * du + def.up.z * dv,
  ];
}

/** World point to pane pixels for the ISO pane. Null when the point is behind the camera. */
export function projectToIsoPane(
  p: Vec3,
  view: IsoViewState,
  paneWidth: number,
  paneHeight: number,
): { x: number; y: number } | null {
  if (paneWidth <= 0 || paneHeight <= 0) return null;

  const position = isoCameraPosition(view);
  const z = position.clone().sub(new THREE.Vector3(...view.target)).normalize();
  const x = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);

  const d = new THREE.Vector3(p[0], p[1], p[2]).sub(position);
  const depth = -d.dot(z); // the camera looks down its own -Z
  if (depth <= 1e-6) return null;

  const tanHalf = Math.tan((ISO_FOV / 2) * DEG);
  const ndcY = d.dot(y) / (depth * tanHalf);
  const ndcX = d.dot(x) / (depth * tanHalf * (paneWidth / paneHeight));

  return { x: ((1 + ndcX) * paneWidth) / 2, y: ((1 - ndcY) * paneHeight) / 2 };
}

/* ------------------------------------------------------------------------ scene bounds */

/**
 * How much room a fit leaves around the vehicle when there is nothing else to frame.
 *
 * An empty layout has only the body to fit, and a tight fit then fills the pane with it — the
 * opening screen showed a car and no ground at all. Framing a box this much larger keeps some
 * context under it. Once a sensor is mounted its coverage is far bigger than this, so the figure
 * stops mattering the moment it would.
 */
export const MIN_CONTEXT = 1.6;

/**
 * Every point that must stay on screen: the vehicle box and a little ground around it, plus each
 * visible sensor's frustum and its ground footprint. Fitting to the frustum corners alone would
 * clip a footprint that runs past the far plane's projection.
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
      // The context box, centred on the body rather than on the origin.
      points.push([sx * MIN_CONTEXT, sy * MIN_CONTEXT, 0]);
      points.push([sx * MIN_CONTEXT, sy * MIN_CONTEXT, top * MIN_CONTEXT]);
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

/** The centre of the vehicle body, which is what a maximised pane centres itself on. */
export function vehicleCentre(vehicle: Vehicle): Vec3 {
  return [0, 0, vehicle.clearance + vehicle.height / 2];
}

/**
 * The pan that puts `point` in the middle of an orthographic pane.
 *
 * `pan` is the world position of the pane centre expressed along that pane's screen-right and
 * screen-up axes, so centring is just the projection — the same two dot products `fitOrtho` and
 * `orthoWorldToPane` use, rather than a third opinion about where the middle is.
 */
export function panForPoint(def: OrthoDef, point: Vec3): [number, number] {
  return [
    point[0] * def.right.x + point[1] * def.right.y + point[2] * def.right.z,
    point[0] * def.up.x + point[1] * def.up.y + point[2] * def.up.z,
  ];
}

/* -------------------------------------------------------------------------- fitting */

export function fitOrtho(
  def: OrthoDef,
  points: Vec3[],
  paneWidth: number,
  paneHeight: number,
  margin = FIT_MARGIN,
  /**
   * Framed symmetrically about this point, so it lands dead centre in the pane.
   *
   * Framing the bounding box instead centres the *extent*, and coverage that all points one way
   * then pushes the vehicle against a border — in LEFT, with every sensor looking forward, it
   * ended up at 86% across. Symmetry costs some size when the content is lopsided, since the
   * shorter side has to be given as much room as the longer one. It buys a pane whose middle is
   * always the vehicle and whose halves are always the same number of metres.
   */
  centreOn?: Vec3,
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

  const pan: [number, number] = centreOn
    ? panForPoint(def, centreOn)
    : [(minU + maxU) / 2, (minV + maxV) / 2];

  // Half-spans measured from wherever the pane centre landed, so nothing falls outside it.
  const halfU = Math.max(maxU - pan[0], pan[0] - minU);
  const halfV = Math.max(maxV - pan[1], pan[1] - minV);

  const spanU = Math.max(halfU * 2, 1e-3) * margin;
  const spanV = Math.max(halfV * 2, 1e-3) * margin;

  return { zoom: Math.min(paneWidth / spanU, paneHeight / spanV), pan };
}

export function fitIso(
  view: IsoViewState,
  points: Vec3[],
  paneWidth: number,
  paneHeight: number,
  margin = FIT_MARGIN,
  /** Pinned as the orbit target, so it sits dead centre. See `fitOrtho`. */
  centreOn?: Vec3,
): IsoViewState | null {
  if (points.length === 0 || paneWidth <= 0 || paneHeight <= 0) return null;

  // The camera basis for the orbit it is already on: `n` points from the target to the camera.
  const el = view.elevation * DEG;
  const az = view.azimuth * DEG;
  const n = new THREE.Vector3(
    Math.cos(el) * Math.cos(az),
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
  );
  const x = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), n).normalize();
  const y = new THREE.Vector3().crossVectors(n, x);

  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points) {
    for (let i = 0; i < 3; i++) {
      if (p[i] < min[i]) min[i] = p[i];
      if (p[i] > max[i]) max[i] = p[i];
    }
  }
  const boxCentre = new THREE.Vector3(
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  );

  /**
   * Projected extents, not a bounding sphere.
   *
   * A sphere around a wide flat layout is far larger than what is actually on screen, so the fit
   * used to pull back until the drawing filled under half the pane, off to one side. Projecting
   * onto the camera's own axes measures what the pane will really show.
   */
  const tanV = Math.tan((ISO_FOV / 2) * DEG) / margin;
  const tanH = tanV * (paneWidth / paneHeight);

  /**
   * A point sits inside the frustum when its offset across the view is within its depth times
   * the half-angle. Depth is `distance − along`, so each point sets a lower bound on the
   * distance and the largest of them is the fit.
   */
  const distanceFor = (t: THREE.Vector3): number => {
    let needed = 0;
    for (const p of points) {
      const d = new THREE.Vector3(p[0], p[1], p[2]).sub(t);
      const along = d.dot(n);
      const want = along + Math.max(Math.abs(d.dot(x)) / tanH, Math.abs(d.dot(y)) / tanV);
      if (want > needed) needed = want;
    }
    return Math.max(needed, 0.5);
  };

  /**
   * Centring has to be iterated, not solved once.
   *
   * Sliding the target across the view centres the *angles*, but the pane shows a perspective
   * projection: points nearer the camera swing further for the same offset, so the picture ends
   * up off-centre anyway — 13% of the pane height on a layout with any depth to it. Each pass
   * measures the error where it actually matters, in the projection, and takes it out. Three is
   * comfortably enough to land inside a pixel.
   */
  let target = centreOn ? new THREE.Vector3(...centreOn) : boxCentre.clone();
  let distance = distanceFor(target);

  // A pinned target is the answer already; there is nothing left to recentre.
  for (let pass = 0; !centreOn && pass < 3; pass++) {
    const camera = target.clone().addScaledVector(n, distance);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const p of points) {
      const v = new THREE.Vector3(p[0], p[1], p[2]).sub(camera);
      const depth = -v.dot(n);
      if (depth <= 1e-6) continue;
      const ndcX = v.dot(x) / (depth * tanH);
      const ndcY = v.dot(y) / (depth * tanV);
      if (ndcX < minX) minX = ndcX;
      if (ndcX > maxX) maxX = ndcX;
      if (ndcY < minY) minY = ndcY;
      if (ndcY > maxY) maxY = ndcY;
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) break;

    target
      .addScaledVector(x, ((minX + maxX) / 2) * tanH * distance)
      .addScaledVector(y, ((minY + maxY) / 2) * tanV * distance);
    distance = distanceFor(target);
  }

  return {
    ...view,
    target: [target.x, target.y, target.z],
    distance,
  };
}
