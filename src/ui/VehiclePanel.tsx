import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { LIMITS } from '../store/persist';
import { useStore } from '../store/useStore';
import NumberField from './NumberField';
import { Panel } from './Panel';

export default function VehiclePanel() {
  const vehicle = useStore((s) => s.vehicle);
  const setVehicle = useStore((s) => s.setVehicle);
  const display = useStore((s) => s.display);
  const setDisplay = useStore((s) => s.setDisplay);

  return (
    <Panel title="Vehicle">
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        <NumberField
          label="Length X"
          unit="m"
          value={vehicle.length}
          min={LIMITS.length[0]}
          max={LIMITS.length[1]}
          onChange={(length) => setVehicle({ length })}
        />
        <NumberField
          label="Width Y"
          unit="m"
          value={vehicle.width}
          min={LIMITS.width[0]}
          max={LIMITS.width[1]}
          onChange={(width) => setVehicle({ width })}
        />
        <NumberField
          label="Height Z"
          unit="m"
          value={vehicle.height}
          min={LIMITS.height[0]}
          max={LIMITS.height[1]}
          onChange={(height) => setVehicle({ height })}
        />
        <NumberField
          label="Ground clearance"
          unit="m"
          value={vehicle.clearance}
          min={LIMITS.clearance[0]}
          max={LIMITS.clearance[1]}
          onChange={(clearance) => setVehicle({ clearance })}
        />
        <NumberField
          label="Wheelbase"
          unit="m"
          value={vehicle.wheelbase}
          min={LIMITS.wheelbase[0]}
          max={LIMITS.wheelbase[1]}
          onChange={(wheelbase) => setVehicle({ wheelbase })}
        />
        <NumberField
          label="Wheel radius"
          unit="m"
          value={vehicle.wheelRadius}
          min={LIMITS.wheelRadius[0]}
          max={LIMITS.wheelRadius[1]}
          onChange={(wheelRadius) => setVehicle({ wheelRadius })}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={display.wheels}
              onChange={(e) => setDisplay({ wheels: e.target.checked })}
            />
          }
          label="Wheels"
          slotProps={{ typography: { variant: 'body2' } }}
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={display.grid}
              onChange={(e) => setDisplay({ grid: e.target.checked })}
            />
          }
          label="1 m grid"
          slotProps={{ typography: { variant: 'body2' } }}
        />
      </Box>
    </Panel>
  );
}
