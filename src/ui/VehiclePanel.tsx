import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import type { VehicleShape } from '../core/types';
import { LIMITS } from '../store/persist';
import { CONTROL_LABEL_SX, CONTROL_LABEL_WIDTH } from '../theme';
import { useStore } from '../store/useStore';
import NumberField from './NumberField';
import { Panel } from './Panel';

export default function VehiclePanel() {
  const vehicle = useStore((s) => s.vehicle);
  const setVehicle = useStore((s) => s.setVehicle);
  const display = useStore((s) => s.display);
  const setDisplay = useStore((s) => s.setDisplay);
  /** The radius the geometry will actually use, whatever the field says. */
  const radiusLimit = Math.min(vehicle.length, vehicle.width) / 2;

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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2 }}>
        <Typography
          variant="caption"
          sx={{ ...CONTROL_LABEL_SX, width: CONTROL_LABEL_WIDTH, flexShrink: 0 }}
        >
          Shape
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={vehicle.shape}
          onChange={(_, v: VehicleShape | null) => v && setVehicle({ shape: v })}
        >
          <ToggleButton value="box" sx={{ px: 1.25, py: 0.25 }}>
            Box
          </ToggleButton>
          <ToggleButton value="rounded" sx={{ px: 1.25, py: 0.25 }}>
            Rounded
          </ToggleButton>
          <ToggleButton value="cylinder" sx={{ px: 1.25, py: 0.25 }}>
            Cylinder
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {vehicle.shape === 'rounded' && (
        <Box sx={{ width: 200, mt: 1.5 }}>
          <NumberField
            label="Corner radius"
            unit="m"
            step={0.05}
            value={vehicle.cornerRadius}
            min={LIMITS.cornerRadius[0]}
            max={LIMITS.cornerRadius[1]}
            onChange={(cornerRadius) => setVehicle({ cornerRadius })}
            helperText={
              vehicle.cornerRadius > radiusLimit
                ? `Drawn at ${radiusLimit.toFixed(2)} m — half the shorter side`
                : undefined
            }
          />
        </Box>
      )}

      {/*
        Spans exactly the width of the fields above: first switch on the left edge, last label on
        the right edge, `space-between` splitting the rest into two equal gaps. The label type is
        a point down from the fields — at 14 px the three come to about 287 px against 302 px of
        column, which leaves 7 px gaps and reads as one crowded blob.
      */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'nowrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          mt: 1.5,
          '& .MuiFormControlLabel-root': { mx: 0 },
          '& .MuiFormControlLabel-label': { whiteSpace: 'nowrap', fontSize: 13 },
        }}
      >
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={display.vehicle}
              onChange={(e) => setDisplay({ vehicle: e.target.checked })}
            />
          }
          label="Vehicle"
          slotProps={{ typography: { variant: 'body2' } }}
        />
        <FormControlLabel
          // The wheels are part of the body, so this does nothing while the body is hidden.
          disabled={!display.vehicle}
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
              checked={display.dimensions}
              onChange={(e) => setDisplay({ dimensions: e.target.checked })}
            />
          }
          label="Dimensions"
          slotProps={{ typography: { variant: 'body2' } }}
        />
      </Box>
    </Panel>
  );
}
