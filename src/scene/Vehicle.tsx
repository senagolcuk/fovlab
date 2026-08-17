import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { roundedRectPolygon } from '../core/footprint';
import { blockInnerExtents, bodyBlocks } from '../core/profile';
import { LAYER } from './layers';
import type { Vehicle } from '../core/types';

const TYRE_WIDTH = 0.22;

/**
 * The vehicle body, its edges, four wheels and a nose marker on the ground.
 *
 * The body is drawn as the blocks its model is made of — one for a bus, three for a car — and
 * they come from the same `bodySegments` the snap and the occlusion warning read, so the drawing
 * cannot end up describing a different vehicle from the numbers.
 *
 * Each block is the plan outline trimmed to its share of the length and extruded upwards.
 * Extruding a `Shape` rounds only the vertical edges, which is what a corner radius means on a
 * vehicle; `RoundedBoxGeometry` would round the roof and the sills too.
 *
 * A three.js cylinder already runs along its local Y, which is vehicle-left here, so a wheel
 * needs no rotation at all.
 */
export default function VehicleBody({
  vehicle,
  wheels,
}: {
  vehicle: Vehicle;
  wheels: boolean;
}) {
  const { width, clearance, wheelbase, wheelRadius } = vehicle;

  const blocks = useMemo(() => {
    const built: THREE.BufferGeometry[] = [];

    for (const block of bodyBlocks(vehicle)) {
      const height = block.top - block.bottom;
      if (height <= 0) continue;
      const { minX, maxX, halfWidth, r } = blockInnerExtents(block, vehicle);
      const plan = roundedRectPolygon(minX, maxX, halfWidth, r);
      if (plan.length < 3) continue;

      const shape = new THREE.Shape(plan.map(([x, y]: [number, number]) => new THREE.Vector2(x, y)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
      // Extrusion runs along +Z from z = 0, so each block starts at its own floor.
      g.translate(0, 0, block.bottom);
      built.push(g);
    }

    return built;
  }, [vehicle, clearance]);

  /** 20°, so a rounded corner reads as an outline rather than as every facet of its arc. */
  const edges = useMemo(() => blocks.map((g) => new THREE.EdgesGeometry(g, 20)), [blocks]);

  /**
   * The blocks as one buffer, for a fill that paints each pixel once.
   *
   * Drawn as separate translucent meshes they compounded wherever one sat over another, so a car
   * read as two ghosts stacked rather than one body. The blocks no longer overlap, but a body is
   * one solid and should shade like one — including where the base's roof meets a cabin's floor.
   */
  const merged = useMemo(() => {
    if (blocks.length === 1) return blocks[0];
    const positions: number[] = [];
    const indices: number[] = [];
    for (const g of blocks) {
      const offset = positions.length / 3;
      const pos = g.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      }
      const index = g.getIndex();
      if (index) for (let i = 0; i < index.count; i++) indices.push(index.getX(i) + offset);
      else for (let i = 0; i < pos.count; i++) indices.push(i + offset);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    return g;
  }, [blocks]);

  const nose = useMemo(() => {
    const x0 = vehicle.length / 2 + 0.12;
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [x0, 0.28, 0.002, x0 + 0.5, 0, 0.002, x0, -0.28, 0.002],
        3,
      ),
    );
    return g;
  }, [vehicle.length]);

  useEffect(() => () => blocks.forEach((g) => g.dispose()), [blocks]);
  useEffect(() => () => {
    // Only when it built one; a single block is handed straight through and disposed above.
    if (merged !== blocks[0]) merged.dispose();
  }, [merged, blocks]);
  useEffect(() => () => edges.forEach((g) => g.dispose()), [edges]);
  useEffect(() => () => nose.dispose(), [nose]);

  const wheelPositions = useMemo(() => {
    const x = wheelbase / 2;
    const y = width / 2 - TYRE_WIDTH / 2;
    return [
      [x, y],
      [x, -y],
      [-x, y],
      [-x, -y],
    ] as Array<[number, number]>;
  }, [wheelbase, width]);

  return (
    <group>
      {/*
        Opaque, and deliberately not depth-tested: the body covers every FOV wherever the two
        meet on screen, whether the volume is in front of it or behind. See `LAYER.VEHICLE_BODY`
        for why the truthful answer is the wrong one here. `transparent` is what puts it in the
        sorted list at all, where the order decides it; the opacity is still 1.

        No `UnionLayer`. It deduplicates overlapping *translucent* fills, and an opaque one
        painted twice is the same colour either way.
      */}
      <mesh geometry={merged} renderOrder={LAYER.VEHICLE_BODY}>
        <meshBasicMaterial
          color="#C3D3DC"
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
          depthTest={false}
        />
      </mesh>

      {/*
        Everything below is `transparent` only to join the sorted render list, and `depthTest:
        false` to stay visible through the solid body it is drawn against — the wheels sit inside
        it and the far edges behind it. That is the drawing this tool has always made: a body you
        can read the running gear through. The cost is that these thin marks also sit over a fan
        passing in front of the car, which at this weight is not worth a second depth pass.
      */}
      {wheels &&
        wheelPositions.map(([x, y]) => (
          <mesh key={`${x},${y}`} position={[x, y, wheelRadius]} renderOrder={LAYER.VEHICLE_WHEELS}>
            <cylinderGeometry args={[wheelRadius, wheelRadius, TYRE_WIDTH, 24]} />
            <meshBasicMaterial
              color="#495F81"
              transparent
              opacity={0.55}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>
        ))}

      {edges.map((geometry, i) => (
        <lineSegments key={i} geometry={geometry} renderOrder={LAYER.VEHICLE_EDGES}>
          <lineBasicMaterial color="#495F81" transparent depthWrite={false} depthTest={false} />
        </lineSegments>
      ))}

      <mesh geometry={nose} renderOrder={LAYER.VEHICLE_EDGES}>
        <meshBasicMaterial
          color="#1E79D3"
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </group>
  );
}
