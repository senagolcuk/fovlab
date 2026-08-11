import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { cornerRadius, innerHalfExtents } from '../core/footprint';
import type { Vehicle } from '../core/types';

const TYRE_WIDTH = 0.22;

/**
 * The vehicle box, its edges, four wheels and a nose marker on the ground.
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
  const { length, width, height, clearance, wheelbase, wheelRadius } = vehicle;
  const centreZ = clearance + height / 2;

  const r = cornerRadius(vehicle);

  /**
   * A box when there is no radius, otherwise the plan outline extruded upwards. Extruding a
   * `Shape` rounds only the vertical edges, which is what a corner radius means on a vehicle —
   * `RoundedBoxGeometry` would round the roof and the sills too.
   */
  const body = useMemo(() => {
    if (r <= 0) return new THREE.BoxGeometry(length, width, height);
    const shape = new THREE.Shape();
    const [iL, iW] = innerHalfExtents(vehicle);
    shape.moveTo(iL + r, -iW);
    shape.lineTo(iL + r, iW);
    shape.absarc(iL, iW, r, 0, Math.PI / 2, false);
    shape.lineTo(-iL, iW + r);
    shape.absarc(-iL, iW, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(-(iL + r), -iW);
    shape.absarc(-iL, -iW, r, Math.PI, (3 * Math.PI) / 2, false);
    shape.lineTo(iL, -(iW + r));
    shape.absarc(iL, -iW, r, (3 * Math.PI) / 2, 2 * Math.PI, false);
    const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 16 });
    // Extrusion runs along +Z from z = 0; the mesh is placed at the body's centre height.
    g.translate(0, 0, -height / 2);
    return g;
  }, [vehicle, r, length, width, height]);

  const edges = useMemo(() => new THREE.EdgesGeometry(body, 20), [body]);

  const nose = useMemo(() => {
    const x0 = length / 2 + 0.12;
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [x0, 0.28, 0.002, x0 + 0.5, 0, 0.002, x0, -0.28, 0.002],
        3,
      ),
    );
    return g;
  }, [length]);

  useEffect(() => () => body.dispose(), [body]);
  useEffect(() => () => edges.dispose(), [edges]);
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
      <mesh position={[0, 0, centreZ]} geometry={body}>
        <meshBasicMaterial
          color="#C3D3DC"
          transparent
          opacity={0.35}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <lineSegments geometry={edges} position={[0, 0, centreZ]}>
        <lineBasicMaterial color="#495F81" />
      </lineSegments>

      <mesh geometry={nose}>
        <meshBasicMaterial color="#1E79D3" side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {wheels &&
        wheelPositions.map(([x, y]) => (
          <mesh key={`${x},${y}`} position={[x, y, wheelRadius]}>
            <cylinderGeometry args={[wheelRadius, wheelRadius, TYRE_WIDTH, 24]} />
            <meshBasicMaterial color="#495F81" transparent opacity={0.55} />
          </mesh>
        ))}
    </group>
  );
}
