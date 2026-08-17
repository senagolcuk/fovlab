/**
 * Two couplings the plan mask depends on, neither of which the type checker can see.
 *
 * The mask is an invisible column that writes depth. Getting either of these wrong does not fail
 * to compile and does not throw — it just quietly deletes geometry from a pane.
 */

import { describe, expect, it } from 'vitest';
import { COLUMN_HALF_HEIGHT, PLAN_MASK_LAYER } from '../PlanMask';
import { ORTHO_DISTANCE } from '../views';

describe('plan mask', () => {
  it('is not on the layer every camera already sees', () => {
    // Layer 0 is enabled on every camera by default. On it, the column would mask the FOV out of
    // FRONT, LEFT and ISO too — a vehicle-shaped hole 800 m tall.
    expect(PLAN_MASK_LAYER).not.toBe(0);
    expect(PLAN_MASK_LAYER).toBeGreaterThanOrEqual(1);
    expect(PLAN_MASK_LAYER).toBeLessThanOrEqual(31); // three has 32
  });

  it('fits inside the ortho camera it is drawn for', () => {
    // The camera stands off by ORTHO_DISTANCE with its near plane just in front of itself, so a
    // column taller than that standoff is clipped at the top and stops masking anything.
    expect(COLUMN_HALF_HEIGHT).toBeLessThan(ORTHO_DISTANCE);
  });
});
