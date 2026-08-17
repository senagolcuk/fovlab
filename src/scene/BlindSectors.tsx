/**
 * Shades the uncovered azimuth sectors on the ground, as a band hugging the vehicle footprint.
 *
 * The band runs from where each ray leaves the footprint out to the report's radius, so it shows
 * exactly the region the report tested rather than a decorative wedge.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { BLIND_RADIUS, footprintExitRadius } from '../core/coverage';
import { DEG } from '../core/rotation';
import type { BlindSector, Vehicle } from '../core/types';
import { LAYER } from './layers';

const LIFT = 0.003;
const STEP_DEG = 1;

export default function BlindSectors({
  blind,
  vehicle,
  visible,
}: {
  blind: BlindSector[];
  vehicle: Vehicle;
  visible: boolean;
}) {
  const geometry = useMemo(() => {
    const positions: number[] = [];

    for (const run of blind) {
      const steps = Math.max(1, Math.ceil((run.endDeg - run.startDeg) / STEP_DEG));
      let prev: { inner: [number, number]; outer: [number, number] } | null = null;

      for (let i = 0; i <= steps; i++) {
        const deg = run.startDeg + ((run.endDeg - run.startDeg) * i) / steps;
        const cos = Math.cos(deg * DEG);
        const sin = Math.sin(deg * DEG);
        const r0 = footprintExitRadius(cos, sin, vehicle);
        const current = {
          inner: [cos * r0, sin * r0] as [number, number],
          outer: [cos * (r0 + BLIND_RADIUS), sin * (r0 + BLIND_RADIUS)] as [number, number],
        };

        if (prev) {
          positions.push(
            prev.inner[0], prev.inner[1], LIFT,
            prev.outer[0], prev.outer[1], LIFT,
            current.outer[0], current.outer[1], LIFT,
            prev.inner[0], prev.inner[1], LIFT,
            current.outer[0], current.outer[1], LIFT,
            current.inner[0], current.inner[1], LIFT,
          );
        }
        prev = current;
      }
    }

    if (positions.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, [blind, vehicle]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!visible || !geometry) return null;

  return (
    <mesh geometry={geometry} renderOrder={LAYER.BLIND_SECTORS}>
      {/*
        Light grey rather than red. A gap is a finding, not a fault, and the red read as an error
        the moment more than a sector or two was uncovered. The opacity is well above what the red
        needed: grey at 0.16 over the near-white ground is invisible. This lands around #E0E0E0.
      */}
      <meshBasicMaterial
        color="#BFBFBF"
        transparent
        opacity={0.42}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
