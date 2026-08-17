/**
 * The vehicle's side profile: how tall the body is at each point along its length.
 *
 * The plan outline is `footprint.ts` and is the same for every model — a car and a bus of the
 * same dimensions take up the same ground. What a model changes is the roofline, so the body is
 * a base block running the whole length with the taller sections stacked on top of it.
 *
 * Stacked rather than laid end to end, and that is the load-bearing choice. Side by side, a
 * block in the middle has two cut ends and no corners to round, so a rounded car came out with a
 * sharp-cornered cabin sitting on a rounded chassis. Stacked, the base carries the full outline —
 * which is what the ground footprint, the blind gap and the sector exit radius all measure — and
 * every block above it is a rounded rectangle in its own right.
 *
 * None of this is decoration. The occlusion warning and the snap read the same blocks the drawing
 * does, so a sensor dropped on a car's bonnet lands on the bonnet rather than at roof height, and
 * a rounded cabin is rounded to the snap as well as to the eye.
 */

import { cornerRadius } from './footprint';
import type { Vec2, Vec3, Vehicle, VehicleModel } from './types';

export interface BodyBlock {
  /** World X of the rear and front ends of this block. */
  minX: number;
  maxX: number;
  /** World Z of its floor and its roof. */
  bottom: number;
  top: number;
}

/**
 * Each entry is `[from, to, height]`: the first two are fractions of the length measured back
 * from the nose, the last a fraction of the height above the clearance.
 *
 * Proportions rather than metres, so the dimensions the engineer types still drive everything —
 * a 12 m bus and a 4.5 m hatchback both get a roofline that belongs to them.
 */
const PROFILES: Record<VehicleModel, ReadonlyArray<readonly [number, number, number]>> = {
  /** One block the whole way: the shape the tool has always drawn, and still the default. */
  bus: [[0, 1, 1]],
  /**
   * Bonnet, cabin, boot — with the boot at bonnet height rather than a little above it.
   *
   * A saloon's boot lid really does sit slightly proud of the beltline, and drawing that put a
   * block barely a tenth of the body's height on top of the base. Its floor and its roof then read
   * as two rings a few centimetres apart: the tail looked double-walled rather than stepped. At
   * this level of abstraction the step earns nothing, so the boot is part of the base and the car
   * is a clean two-level shape.
   */
  car: [
    [0, 0.26, 0.5],
    [0.26, 0.72, 1],
    [0.72, 1, 0.5],
  ],
  /** A short bonnet, then a box body the rest of the way. */
  van: [
    [0, 0.18, 0.52],
    [0.18, 1, 1],
  ],
};

export const VEHICLE_MODELS: VehicleModel[] = ['car', 'van', 'bus'];

/**
 * The body as blocks, lowest first.
 *
 * The first always spans the whole length, at the height of the lowest section — so whatever the
 * model, the body meets the ground as the full footprint. The rest are the sections that stand
 * above it.
 */
export function bodyBlocks(vehicle: Vehicle): BodyBlock[] {
  const nose = vehicle.length / 2;
  const sections = PROFILES[vehicle.model] ?? PROFILES.bus;
  const base = Math.min(...sections.map(([, , h]) => h));

  const waist = vehicle.clearance + base * vehicle.height;
  const blocks: BodyBlock[] = [
    { minX: -nose, maxX: nose, bottom: vehicle.clearance, top: waist },
  ];

  /**
   * The sections above the base start *at* it rather than at the ground.
   *
   * Overlapping instead, a cabin was a second solid standing inside the first: its fill doubled
   * over the base, its vertical edges ran down through the body to the sills, and the base's roof
   * line crossed it. Sitting on the waist, each upper block adds only what is actually above it,
   * and the seam it leaves is the beltline a real body has anyway.
   */
  for (const [from, to, h] of sections) {
    if (h <= base) continue;
    blocks.push({
      minX: nose - to * vehicle.length,
      maxX: nose - from * vehicle.length,
      bottom: waist,
      top: vehicle.clearance + h * vehicle.height,
    });
  }

  return blocks;
}

/** The corner radius a block can carry: never more than half its own shorter side. */
export function blockRadius(block: BodyBlock, vehicle: Vehicle): number {
  const limit = Math.min(block.maxX - block.minX, vehicle.width) / 2;
  return Math.min(cornerRadius(vehicle), limit);
}

/** Inner half-extents of the rectangle a block's corner discs sweep around. */
export function blockInnerExtents(block: BodyBlock, vehicle: Vehicle): {
  minX: number;
  maxX: number;
  halfWidth: number;
  r: number;
} {
  const r = blockRadius(block, vehicle);
  return {
    minX: block.minX + r,
    maxX: block.maxX - r,
    halfWidth: Math.max(0, vehicle.width / 2 - r),
    r,
  };
}

/** Whether a plan point falls within a block's own rounded outline. */
/**
 * Signed distance from a point to a block's plan outline, in metres: negative inside, zero on it.
 *
 * The plan is the inner rectangle swept by a disc of radius `r`, so the standard rounded-box
 * form applies. Written signed rather than as a yes/no because the interesting question is not
 * always "inside?" — a mounting point lands exactly *on* the outline, and telling that apart from
 * one buried a hand's width in needs a quantity, not a predicate.
 */
export function blockPlanDistance(p: Vec2, block: BodyBlock, vehicle: Vehicle): number {
  const { minX, maxX, halfWidth, r } = blockInnerExtents(block, vehicle);
  const dx = Math.abs(p[0] - (minX + maxX) / 2) - (maxX - minX) / 2;
  const dy = Math.abs(p[1]) - halfWidth;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside - r;
}

export function isInsideBlockPlan(p: Vec2, block: BodyBlock, vehicle: Vehicle): boolean {
  return blockPlanDistance(p, block, vehicle) <= 1e-12;
}

/** Whether a point is within the body itself — any one of its blocks. */
/**
 * How far off a face a mounting point may be and still count as on it, rather than in.
 *
 * A micron. The snap writes the face coordinate exactly, so this only has to absorb arithmetic,
 * not judgement: at a millimetre in, the sensor really is behind the panel and should be told so.
 */
export const SURFACE_TOLERANCE = 1e-6;

/**
 * Whether a point is *within* the body, as opposed to mounted on it.
 *
 * Strictly within, which is the whole point. The body's skin is where sensors go, and the test
 * used to include it: every sensor the snap placed — the tool's own idea of a correct mounting —
 * came back occluded, so the warning fired on exactly the layouts that had got it right.
 */
export function isInsideBodySolid(
  p: Vec3,
  vehicle: Vehicle,
  margin = SURFACE_TOLERANCE,
): boolean {
  return bodyBlocks(vehicle).some(
    (block) =>
      p[2] > block.bottom + margin &&
      p[2] < block.top - margin &&
      blockPlanDistance([p[0], p[1]], block, vehicle) < -margin,
  );
}

/**
 * The roofline above `x`, ignoring how far off the centreline the point is.
 *
 * Blocks meet at a shared edge, so a point on a step belongs to the taller of the two: the step
 * face is part of the body, and a sensor on it should sit against the tall side.
 */
export function bodyTopAt(x: number, vehicle: Vehicle): number {
  let top = vehicle.clearance;
  // Blocks stack, so the roofline is still the highest one covering this station.
  for (const b of bodyBlocks(vehicle)) {
    if (x >= b.minX && x <= b.maxX && b.top > top) top = b.top;
  }
  return top;
}

/** The tallest point of the body, which is the height the engineer typed. */
export function bodyMaxTop(vehicle: Vehicle): number {
  return vehicle.clearance + vehicle.height;
}
