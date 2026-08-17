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
   * The vehicle.
   *
   * A sensor is mounted *on* the vehicle, so its volume starts inside the body and every FOV
   * overlaps it. Painted underneath, the body vanished into whichever fan covered it and the
   * thing every measurement is relative to became the hardest object to see.
   *
   * The body is the exception to everything said above: it is opaque and it writes depth, so it
   * is drawn in the depth-tested pass before any of these orders apply. That is what decides the
   * FOV against it — behind the body rejected, in front of it kept — where a `renderOrder` alone
   * could only ever put one of them on top everywhere. The numbers here still order the vehicle's
   * own marks, which are drawn afterwards and read through it.
   */
  VEHICLE_BODY: 50,
  /**
   * After the body, and this order is load-bearing. Both are opaque, and three sorts the opaque
   * pass by `renderOrder` before distance — without it the column, whose top is 400 m up, would
   * be nearer than the roof and would mask out the very body it exists to extend.
   */
  VEHICLE_PLAN_MASK: 55,
  VEHICLE_WHEELS: 60,
  VEHICLE_EDGES: 70,

  /** Sensor markers last: they are handles to click, not geometry to look through. */
  SENSOR_MARKER: 80,
  SENSOR_MARKER_SELECTION: 90,
} as const;
