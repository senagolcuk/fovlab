/**
 * Every visible sensor's FOV drawn as one volume.
 *
 * Nothing about the geometry changes: each sensor keeps its own pose, angles and range, and the
 * merged draw covers exactly the space the separate draws did. What changes is the shading —
 * where two volumes overlap the colour stops compounding, so the coverage reads as one shape
 * rather than a stack of translucent shells.
 *
 * The union is done in the depth buffer, not with a mesh boolean. A depth-only pass records the
 * nearest surface per pixel; the colour pass then draws only fragments at exactly that depth. One
 * layer of colour per pixel, whatever the overlaps — and it costs a second draw call rather than a
 * CSG solve, so twenty sensors stay interactive.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { effectiveSpec } from '../core/catalog';
import { clampSpec } from '../core/frustum';
import type { SensorInstance, SensorSpec } from '../core/types';
import type { DisplayOptions } from '../store/useStore';
import { PALETTE } from '../theme';
import { concatIndexed, fovBuffers, toBufferGeometry, type IndexedGeometry } from './fovGeometry';
import UnionLayer from './UnionLayer';

/**
 * One colour, because it is one shape. The house blue rather than a sensor colour: nothing in the
 * merged volume belongs to any single sensor, and borrowing one sensor's colour would say it did.
 */
export const MERGE_COLOR = PALETTE.blue;

export default function MergedFov({
  sensors,
  catalog,
  display,
  clip,
}: {
  sensors: SensorInstance[];
  catalog: SensorSpec[];
  display: DisplayOptions;
  clip: THREE.Plane[] | null;
}) {
  /**
   * Volume and footprint go into **one** union, not two.
   *
   * Drawn as separate unions they were two layers, and each layer's nearest-surface test only
   * deduplicates within itself: footprints all sit on the ground plane, equally near, so two
   * overlapping ones both painted and the intersection came out darker than the rest — the exact
   * compounding this option exists to remove. In one union the volume's upper surface is nearer
   * than any footprint, so a pixel is painted once whatever lies beneath it.
   */
  const geometry = useMemo(() => {
    const parts: IndexedGeometry[] = [];
    const wantsFootprint = !display.belowGround;

    for (const sensor of sensors) {
      if (!sensor.visible) continue;
      const spec = clampSpec(effectiveSpec(sensor, catalog));
      const buffers = fovBuffers(sensor.pose, spec);
      if (display.volume) {
        parts.push({ positions: buffers.positions, indices: buffers.triangles });
      }
      // Closes the cut the ground clip leaves open, exactly as the per-sensor drawing does.
      if (wantsFootprint && buffers.footprint) parts.push(buffers.footprint);
    }

    return parts.length ? toBufferGeometry(concatIndexed(parts)) : null;
  }, [sensors, catalog, display.volume, display.belowGround]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;

  /**
   * The footprint alone would be too faint at the volume's own opacity — it is a single sheet
   * where the volume is a solid — so it keeps the weighting the per-sensor drawing gives it,
   * but only when there is no volume over it to read instead.
   */
  const opacity = display.volume
    ? Math.min(display.opacity, 0.85)
    : Math.min(display.opacity * 1.9, 0.92);

  return (
    <UnionLayer
      geometry={geometry}
      color={MERGE_COLOR}
      opacity={opacity}
      renderOrder={2}
      clip={clip}
    />
  );
}
