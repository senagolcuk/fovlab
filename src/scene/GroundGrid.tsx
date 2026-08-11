import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/** A heavier line every this many cells. */
const MAJOR_EVERY = 10;
/** Fine cells drawn either side of the origin, then major cells beyond. */
const FINE_CELLS = 25;
const MAJOR_CELLS = 20;

/**
 * How far the two grids reach, for a given cell size in metres.
 *
 * Counted in cells rather than metres, so the line count is the same whatever the spacing is:
 * a 10 mm grid does not cost more to draw than a 1 m one, it just covers less ground. At the
 * 1 m default this gives fine detail to 25 m and a coarse grid out to 200 m.
 */
export function gridExtents(size: number): {
  fineHalf: number;
  majorStep: number;
  coarseHalf: number;
} {
  const majorStep = MAJOR_EVERY * size;
  return {
    fineHalf: FINE_CELLS * size,
    majorStep,
    coarseHalf: MAJOR_CELLS * majorStep,
  };
}

/** Ground grid on z = 0, with a heavier line every 10 cells and the X and Y axes picked out. */
export default function GroundGrid({ visible, size }: { visible: boolean; size: number }) {
  const { minor, major, axes } = useMemo(() => {
    const minorPts: number[] = [];
    const majorPts: number[] = [];
    const { fineHalf, majorStep, coarseHalf } = gridExtents(size);

    for (let n = -FINE_CELLS; n <= FINE_CELLS; n++) {
      if (n === 0 || n % MAJOR_EVERY === 0) continue;
      const i = n * size;
      minorPts.push(i, -fineHalf, 0, i, fineHalf, 0);
      minorPts.push(-fineHalf, i, 0, fineHalf, i, 0);
    }

    for (let n = -MAJOR_CELLS; n <= MAJOR_CELLS; n++) {
      if (n === 0) continue;
      const i = n * majorStep;
      majorPts.push(i, -coarseHalf, 0, i, coarseHalf, 0);
      majorPts.push(-coarseHalf, i, 0, coarseHalf, i, 0);
    }

    const axisPts = [-coarseHalf, 0, 0, coarseHalf, 0, 0, 0, -coarseHalf, 0, 0, coarseHalf, 0];

    const build = (pts: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      return g;
    };

    return { minor: build(minorPts), major: build(majorPts), axes: build(axisPts) };
  }, [size]);

  // r3f only disposes what it created itself, and these are rebuilt whenever the spacing moves.
  useEffect(
    () => () => {
      minor.dispose();
      major.dispose();
      axes.dispose();
    },
    [minor, major, axes],
  );

  if (!visible) return null;

  return (
    <group renderOrder={-1}>
      {/* Cool greys stepped towards the slate, so the grid recedes under the palette. */}
      <lineSegments geometry={minor}>
        <lineBasicMaterial color="#D6DEE6" transparent opacity={0.8} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={major}>
        <lineBasicMaterial color="#A8B6C6" depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={axes}>
        <lineBasicMaterial color="#7C8CA3" depthWrite={false} />
      </lineSegments>
    </group>
  );
}
