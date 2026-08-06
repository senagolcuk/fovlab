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
  const selectedId = useStore((s) => s.selectedId);
  const report = useStore((s) => s.blindReport);

  return (
    <>
      <GroundGrid visible={display.grid} />
      {report && (
        <BlindSectors
          blind={report.blind}
          vehicle={vehicle}
          visible={blindSectors && display.blindSectors}
        />
      )}
      <VehicleBody vehicle={vehicle} wheels={display.wheels} />
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
