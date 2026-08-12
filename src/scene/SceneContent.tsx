import { useStore } from '../store/useStore';
import BlindSectors from './BlindSectors';
import GroundGrid from './GroundGrid';
import SensorFov from './SensorFov';
import VehicleBody from './Vehicle';

/** The scene body, rendered once per pane — each `<View>` has its own virtual scene. */
export default function SceneContent({ blindSectors = false }: { blindSectors?: boolean }) {
  const vehicle = useStore((s) => s.vehicle);
  const sensors = useStore((s) => s.sensors);
  const catalog = useStore((s) => s.catalog);
  const display = useStore((s) => s.display);
  const rangeMode = useStore((s) => s.rangeMode);
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
      {sensors.map((sensor) => (
        <SensorFov
          key={sensor.id}
          sensor={sensor}
          catalog={catalog}
          rangeMode={rangeMode}
          display={display}
          selected={sensor.id === selectedId}
        />
      ))}
    </>
  );
}
