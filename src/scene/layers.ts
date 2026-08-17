/**
 * What is drawn in front of what.
 *
 * Every surface in the scene sets `depthWrite: false`, because they are all translucent and a
 * depth buffer would let whichever fragment happened to arrive first hide the ones behind it.
 * That leaves `renderOrder` as the only thing deciding the stack, so the stack is written down
 * here rather than as a bare number in each of six files.
 *
 * Bottom to top. Gaps of ten because `UnionLayer` spends `renderOrder + 1` on its colour pass,
 * and because the next thing to slot in between two of these should not force a renumber.
 */
export const LAYER = {
  GRID: -10,
  /** Uncovered azimuth sectors, on the ground in the TOP pane. */
  BLIND_SECTORS: 0,

  /** The FOV's ground section: fill, then its outline. */
  FOV_FOOTPRINT: 10,
  FOV_VOLUME: 20,
  FOV_EDGES: 30,
  FOV_OUTLINE: 40,

  /**
   * The vehicle sits above the FOV, not below it, and paints solid.
   *
   * A sensor is mounted *on* the vehicle, so its volume starts inside the body and every FOV
   * overlaps it. Painted underneath, the body vanished into whichever fan covered it and the
   * thing every measurement is relative to became the hardest object to see. Painted above but
   * translucent, both were visible at once through the same pixels, which in TOP reads as a
   * stain rather than as one object in front of another. So the body is opaque: where they
   * overlap you get the vehicle, and only the vehicle.
   *
   * The wheels go *after* the body for that reason — under an opaque fill they would not be
   * there at all.
   */
  VEHICLE_BODY: 50,
  VEHICLE_WHEELS: 60,
  VEHICLE_EDGES: 70,

  /** Sensor markers last: they are handles to click, not geometry to look through. */
  SENSOR_MARKER: 80,
  SENSOR_MARKER_SELECTION: 90,
} as const;
