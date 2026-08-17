/**
 * The vehicle as a solid column, for the TOP pane only.
 *
 * The body already occludes the FOV by depth, which is right in every pane that has a horizon.
 * TOP does not. Looking straight down, "inside the body" and "in the airspace above the roof"
 * land on the same pixels, and a sensor on the flank whose field opens upwards reaches the second
 * one: a 20° half-angle from 1.6 m clears a 2.65 m roof at 2.9 m out, so the fan reappears over
 * the rear of the vehicle. Geometrically true, and unreadable — it looks like the volume is
 * coming out of the inside of the vehicle, which is the one thing a plan view must not suggest.
 *
 * So in TOP the vehicle occludes its whole column rather than its solid. Nothing but the vehicle
 * is drawn inside its outline, which is what a plan drawing means by a solid object.
 *
 * Writes depth and no colour: the visible body is drawn by `Vehicle`, before this, and this only
 * has to stop what comes after. It is confined to the TOP camera by a three layer — every other
 * pane keeps the true 3D occlusion, where the height difference is visible and the fan passing
 * over the roof is worth seeing.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { cornerRadius, roundedRectPolygon } from '../core/footprint';
import type { Vehicle } from '../core/types';
import { LAYER } from './layers';

/**
 * The three layer only the TOP camera enables. Layer 0 is everything else, on every camera.
 */
export const PLAN_MASK_LAYER = 1;

/**
 * Half the column's height. Comfortably past any FOV a sensor can have and comfortably inside
 * the ortho camera's 500 m standoff, so the column is never clipped at either end.
 */
export const COLUMN_HALF_HEIGHT = 400;

export default function PlanMask({ vehicle }: { vehicle: Vehicle }) {
  const ref = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const plan = roundedRectPolygon(
      -vehicle.length / 2,
      vehicle.length / 2,
      vehicle.width / 2,
      cornerRadius(vehicle),
    );
    if (plan.length < 3) return null;
    const shape = new THREE.Shape(plan.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: COLUMN_HALF_HEIGHT * 2,
      bevelEnabled: false,
    });
    g.translate(0, 0, -COLUMN_HALF_HEIGHT);
    return g;
  }, [vehicle]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  useLayoutEffect(() => {
    ref.current?.layers.set(PLAN_MASK_LAYER);
  }, [geometry]);

  if (!geometry) return null;

  return (
    <mesh ref={ref} geometry={geometry} renderOrder={LAYER.VEHICLE_PLAN_MASK}>
      <meshBasicMaterial colorWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
