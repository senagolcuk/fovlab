/**
 * Buffer building for one sensor's FOV, shared by the per-sensor drawing and the merged one.
 *
 * Kept out of the components so both read the same geometry from the same call: a merged volume
 * that disagreed with the individual volumes it replaced would be worse than no merge at all.
 */

import * as THREE from 'three';
import { frustum } from '../core/frustum';
import { groundPolygon } from '../core/ground';
import type { FovSpec, Pose, RangeMode } from '../core/types';

/** Lifted off the ground plane just enough to beat the grid in the depth test. */
export const GROUND_LIFT = 0.005;

export interface IndexedGeometry {
  positions: number[];
  indices: number[];
}

export interface FovBuffers {
  /** Apex and far surface, world coordinates. */
  positions: number[];
  /** Triangle indices into `positions`. */
  triangles: number[];
  /** Line-segment indices into `positions`: the silhouette, not every edge. */
  outline: number[];
  /** The ground section, as a closed ring. Null when the volume never reaches the ground. */
  footprint: IndexedGeometry | null;
}

export function fovBuffers(
  pose: Pose,
  spec: FovSpec,
  mode: RangeMode,
  lift = GROUND_LIFT,
): FovBuffers {
  const f = frustum(pose, spec, mode);

  const positions: number[] = [];
  for (const v of f.vertices) positions.push(v[0], v[1], v[2]);

  const poly = groundPolygon(f);
  let footprint: IndexedGeometry | null = null;

  if (poly) {
    const ring: number[] = [];
    for (const [x, y] of poly) ring.push(x, y, lift);
    const indices: number[] = [];
    for (let i = 1; i < poly.length - 1; i++) indices.push(0, i, i + 1);
    footprint = { positions: ring, indices };
  }

  return {
    positions,
    triangles: f.triangles.flatMap((t) => [t[0], t[1], t[2]]),
    outline: f.outline.flatMap((e) => [e[0], e[1]]),
    footprint,
  };
}

/**
 * Concatenates indexed geometry into one buffer, shifting each part's indices past the vertices
 * already placed. Parts keep their own coordinates, so nothing is scaled, clipped or re-fitted —
 * a merged draw covers exactly the same space as the separate draws it replaces.
 */
export function concatIndexed(parts: IndexedGeometry[]): IndexedGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  for (const part of parts) {
    const offset = positions.length / 3;
    for (const p of part.positions) positions.push(p);
    for (const i of part.indices) indices.push(i + offset);
  }

  return { positions, indices };
}

export function toBufferGeometry(g: IndexedGeometry): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(g.positions, 3));
  geometry.setIndex(g.indices);
  return geometry;
}
