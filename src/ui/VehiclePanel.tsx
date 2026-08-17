import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import DownloadIcon from '@mui/icons-material/Download';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Snackbar from '@mui/material/Snackbar';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import UploadIcon from '@mui/icons-material/Upload';
import Typography from '@mui/material/Typography';
import type { VehicleModel, VehicleShape } from '../core/types';
import {
  DEFAULT_VEHICLE,
  LIMITS,
  downloadVehicle,
  readVehicleFile,
} from '../store/persist';
import { CONTROL_LABEL_SX, CONTROL_LABEL_WIDTH } from '../theme';
import { useStore } from '../store/useStore';
import NumberField from './NumberField';
import { Panel } from './Panel';

/** Trimmed so both labels, both glyphs and the reset mark share one row at 340 px. */
const FILE_BUTTON_SX = {
  px: 0.5,
  minWidth: 0,
  '& .MuiButton-startIcon': { mr: 0.5, ml: 0, '& svg': { fontSize: 17 } },
} as const;

export default function VehiclePanel() {
  const vehicle = useStore((s) => s.vehicle);
  const setVehicle = useStore((s) => s.setVehicle);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      setVehicle(await readVehicleFile(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be read.');
    }
  };
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

      {/*
        Which roofline the body has. The plan outline is `Shape`'s business, and the two are
        independent: a van is as entitled to rounded corners as a bus.
      */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2 }}>
        <Typography
          variant="caption"
          sx={{ ...CONTROL_LABEL_SX, width: CONTROL_LABEL_WIDTH, flexShrink: 0 }}
        >
          Model
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={vehicle.model}
          onChange={(_, v: VehicleModel | null) => v && setVehicle({ model: v })}
        >
          <ToggleButton value="car" sx={{ px: 1.25, py: 0.25 }}>
            Car
          </ToggleButton>
          <ToggleButton value="van" sx={{ px: 1.25, py: 0.25 }}>
            Van
          </ToggleButton>
          <ToggleButton value="bus" sx={{ px: 1.25, py: 0.25 }}>
            Bus
          </ToggleButton>
        </ToggleButtonGroup>
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
                ? `Drawn at ${radiusLimit.toFixed(2)} m: half the shorter side`
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
      {/*
        The body alone, so it can be carried between layouts. Separate from the layout file for
        the reason the layout file was confusing under SENSORS: what a button saves should be what
        its panel is about.
      */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 2 }}>
        {/*
          All three on one row at the 340 px the sidebar is allowed to reach, which two labels and
          two glyphs do not fit at the default padding. The room comes from the padding and the gap
          beside each glyph rather than from the type, which stays the size it is everywhere else.
        */}
        <Button
          size="small"
          startIcon={<DownloadIcon />}
          onClick={() => downloadVehicle(vehicle)}
          sx={FILE_BUTTON_SX}
        >
          Export vehicle
        </Button>
        <Button
          size="small"
          startIcon={<UploadIcon />}
          onClick={() => fileRef.current?.click()}
          sx={FILE_BUTTON_SX}
        >
          Import vehicle
        </Button>
        {/*
          A mark, like the ones in the sensor row: the two file actions need their noun to say
          which file they mean, and spelling out Reset as well pushed the row onto a second line at
          the narrowest the sidebar goes.
        */}
        <Tooltip title="Back to the default body. Ctrl+Z brings yours back.">
          <IconButton size="small" color="error" sx={{ p: 0.5 }} onClick={() => setVehicle(DEFAULT_VEHICLE)}>
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void onImport(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </Box>

      <Snackbar
        open={Boolean(error)}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        message={error ?? ''}
      />

    </Panel>
  );
}
