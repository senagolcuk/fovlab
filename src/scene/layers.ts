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
   * The vehicle, drawn solid over every FOV rather than depth-tested against them.
   *
   * Depth is the truthful answer and it is not the useful one. A sensor is mounted *on* the
   * vehicle, so its volume starts at the body and spreads around it: a flank camera's field
   * passes over the roof, a bumper camera's wraps down the side. All of that is genuinely nearer
   * the camera than the panel behind it, so depth draws it, and the vehicle ends up washed in
   * whichever colours happen to surround it — least legible exactly where the sensors are
   * densest. The body is the reference every angle and offset is measured from. It stays clean.
   */
  VEHICLE_BODY: 50,
  VEHICLE_WHEELS: 60,
  VEHICLE_EDGES: 70,

  /**
   * The FOV's silhouette, drawn again over the vehicle it was just hidden behind.
   *
   * Hiding the volume alone leaves a fan that begins at the vehicle's outline instead of at its
   * sensor, which reads as a volume with no source. The outline carries the connection across
   * without tinting anything: one line each way, the drawing convention for an edge you cannot
   * see through.
   */
  FOV_OUTLINE_OVER_BODY: 75,

  /** Sensor markers last: they are handles to click, not geometry to look through. */
  SENSOR_MARKER: 80,
  SENSOR_MARKER_SELECTION: 90,
} as const;
