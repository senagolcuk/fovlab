import * as THREE from 'three';
import { useStore } from '../store/useStore';
import BlindSectors from './BlindSectors';
import GroundGrid from './GroundGrid';
import MergedFov from './MergedFov';
import SensorFov from './SensorFov';
import VehicleBody from './Vehicle';

/**
 * Keeps the volume at or above the ground. A shader clip rather than a geometry cut: the solid
 * stays one polyhedron, so the ground section and every number derived from it are untouched by
 * what is merely hidden.
 */
const GROUND_PLANE = [new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)];

/** The scene body, rendered once per pane — each `<View>` has its own virtual scene. */
export default function SceneContent({ blindSectors = false }: { blindSectors?: boolean }) {
  const vehicle = useStore((s) => s.vehicle);
  const sensors = useStore((s) => s.sensors);
  const catalog = useStore((s) => s.catalog);
  const display = useStore((s) => s.display);
  const selectedId = useStore((s) => s.selectedId);
  const report = useStore((s) => s.blindReport);

  return (
    <>
      <GroundGrid visible={display.grid} size={display.gridSize} />
      {/*
        With nothing mounted every sector is blind, which is true but useless: it shades the whole
        ring red on the opening screen and reads as an error rather than a finding. The report is
        only worth drawing once there is coverage to have a gap in.
      */}
      {report && sensors.some((s) => s.visible) && (
        <BlindSectors
          blind={report.blind}
          vehicle={vehicle}
          visible={blindSectors && display.blindSectors}
        />
      )}
      {display.vehicle && <VehicleBody vehicle={vehicle} wheels={display.wheels} />}
      {display.mergeFovs && (
        <MergedFov
          sensors={sensors}
          catalog={catalog}
          display={display}
          clip={display.belowGround ? null : GROUND_PLANE}
        />
      )}
      {sensors.map((sensor) => (
        <SensorFov
          key={sensor.id}
          sensor={sensor}
          catalog={catalog}
          display={display}
          selected={sensor.id === selectedId}
        />
      ))}
    </>
  );
}
