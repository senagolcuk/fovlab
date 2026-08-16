import * as THREE from 'three';

/**
 * Paints a whole set of overlapping geometry exactly once per pixel.
 *
 * The mask pass marks every covered pixel in the stencil buffer. The colour pass then paints
 * only where the mark is still standing and clears it as it goes, so the first fragment to reach
 * a pixel paints and every later one is rejected. Which fragment gets there first does not matter:
 * they are all the same flat colour.
 *
 * Depth was the obvious tool and could not do this job. It deduplicates by *distance*, so two
 * footprints lying on the ground plane are equally near and both paint — the overlap came out
 * darker than the rest, which is the compounding this option exists to remove. Getting close
 * needed a bias, and the bias then had to be small enough not to admit a second surface and large
 * enough to survive two rasterisations of a shared edge disagreeing in the last bit. Stencil is
 * a counter rather than a measurement, so none of that arises.
 *
 * `transparent` on the mask pass is not for blending — it is what puts both draws in the same
 * render list, so `renderOrder` decides their sequence.
 */
export default function UnionLayer({
  geometry,
  color,
  opacity,
  renderOrder,
  clip,
}: {
  geometry: THREE.BufferGeometry;
  color: string;
  opacity: number;
  renderOrder: number;
  clip: THREE.Plane[] | null;
}) {
  return (
    <>
      <mesh geometry={geometry} renderOrder={renderOrder}>
        <meshBasicMaterial
          colorWrite={false}
          transparent
          depthWrite={false}
          stencilWrite
          stencilRef={1}
          stencilFunc={THREE.AlwaysStencilFunc}
          // Only where the depth test also passed, so geometry behind the body stays hidden.
          stencilZPass={THREE.ReplaceStencilOp}
          side={THREE.DoubleSide}
          clippingPlanes={clip}
        />
      </mesh>
      <mesh geometry={geometry} renderOrder={renderOrder + 1}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          depthWrite={false}
          stencilWrite
          stencilRef={1}
          stencilFunc={THREE.EqualStencilFunc}
          // Spend the mark on the way past, so this pixel cannot be painted twice.
          stencilZPass={THREE.ZeroStencilOp}
          side={THREE.DoubleSide}
          clippingPlanes={clip}
        />
      </mesh>
    </>
  );
}
