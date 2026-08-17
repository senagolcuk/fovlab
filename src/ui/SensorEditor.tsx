/**
 * The inline editor for the selected sensor.
 *
 * Every angle field carries its sign convention in the label. Engineers get these wrong
 * otherwise, and a wrong sign is invisible until the FOV points the wrong way.
 */

import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { effectiveSpec } from '../core/catalog';
import { FOV_INPUT_MAX, FOV_MIN, RANGE_MIN, frustum } from '../core/frustum';
import { groundCoverage, isInsideBody } from '../core/ground';
import type { SensorInstance } from '../core/types';
import { LIMITS } from '../store/persist';
import { SENSOR_COLORS, useStore } from '../store/useStore';
import CatalogPicker from './CatalogPicker';
import NumberField from './NumberField';
import { Readout } from './Panel';

/**
 * Shown for a readout that has no answer rather than a zero one, which happens only when the
 * volume never reaches the ground. A word rather than a dash: a lone dash in a column of numbers
 * reads as a minus sign for as long as it takes to look twice.
 */
const NO_VALUE = 'n/a';

function ColorSwatch({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: color,
        border: 1,
        borderColor: 'rgba(0,0,0,0.2)',
        flexShrink: 0,
      }}
    />
  );
}

export default function SensorEditor({ sensor }: { sensor: SensorInstance }) {
  const catalog = useStore((s) => s.catalog);
  const vehicle = useStore((s) => s.vehicle);
  const updateSensor = useStore((s) => s.updateSensor);
  const updatePose = useStore((s) => s.updatePose);
  const removeSensor = useStore((s) => s.removeSensor);
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null);

  const spec = effectiveSpec(sensor, catalog);
  const inherited = sensor.specId !== null;

  const coverage = useMemo(
    () => groundCoverage(frustum(sensor.pose, spec), vehicle),
    [sensor.pose, spec.hfov, spec.vfov, spec.range, vehicle],
  );

  const insideBody = isInsideBody(sensor.pose, vehicle);

  /** Writing an FOV field means overriding the catalogue spec, or editing the custom block. */
  const setFov = (patch: Partial<typeof spec>) => {
    if (inherited) {
      updateSensor(sensor.id, { override: { ...sensor.override, ...patch } });
    } else {
      updateSensor(sensor.id, { custom: { ...spec, ...patch } });
    }
  };

  const fmt = (v: number, digits = 2) => v.toFixed(digits);

  /**
   * At 180° and wider there is no image rectangle and no flat far plane, so the field is swept by
   * angle and drawn radially whatever the range mode says. The figure itself is drawn as typed;
   * what changes is the model behind it, so name that rather than leave the picture unexplained.
   */
  const clampNote = (value: number) => (value >= 180 ? 'swept by angle' : undefined);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, py: 1 }}>
      <CatalogPicker sensor={sensor} />

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          label="Name"
          value={sensor.name}
          fullWidth
          onChange={(e) => updateSensor(sensor.id, { name: e.target.value })}
        />
        <Button
          onClick={(e) => setColorAnchor(e.currentTarget)}
          sx={{ minWidth: 0, p: 1 }}
          aria-label="Colour"
        >
          <ColorSwatch color={sensor.color} size={22} />
        </Button>
        <Menu
          anchorEl={colorAnchor}
          open={Boolean(colorAnchor)}
          onClose={() => setColorAnchor(null)}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, p: 1.5 }}>
            {SENSOR_COLORS.map((c) => (
              <Box
                key={c}
                onClick={() => {
                  updateSensor(sensor.id, { color: c });
                  setColorAnchor(null);
                }}
                sx={{ cursor: 'pointer', p: 0.25 }}
              >
                <ColorSwatch color={c} size={24} />
              </Box>
            ))}
          </Box>
        </Menu>
      </Box>

      <Typography variant="subtitle2" sx={{ color: 'text.secondary', mt: 0.5 }}>
        POSITION
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
        <NumberField
          label="X (fwd)"
          unit="m"
          value={sensor.pose.x}
          min={LIMITS.x[0]}
          max={LIMITS.x[1]}
          onChange={(x) => updatePose(sensor.id, { x })}
        />
        <NumberField
          label="Y (left)"
          unit="m"
          value={sensor.pose.y}
          min={LIMITS.y[0]}
          max={LIMITS.y[1]}
          onChange={(y) => updatePose(sensor.id, { y })}
        />
        <NumberField
          label="Z (up)"
          unit="m"
          value={sensor.pose.z}
          min={LIMITS.z[0]}
          max={LIMITS.z[1]}
          onChange={(z) => updatePose(sensor.id, { z })}
        />
      </Box>

      <Typography variant="subtitle2" sx={{ color: 'text.secondary', mt: 0.5 }}>
        ORIENTATION
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
        <NumberField
          label="Yaw (+ left)"
          unit="°"
          step={1}
          value={sensor.pose.yaw}
          min={-360}
          max={360}
          onChange={(yaw) => updatePose(sensor.id, { yaw })}
        />
        <NumberField
          label="Pitch (+ up)"
          unit="°"
          step={1}
          value={sensor.pose.pitch}
          min={-90}
          max={90}
          onChange={(pitch) => updatePose(sensor.id, { pitch })}
        />
        <NumberField
          label="Roll (+ CW)"
          unit="°"
          step={1}
          value={sensor.pose.roll}
          min={-360}
          max={360}
          onChange={(roll) => updatePose(sensor.id, { roll })}
        />
      </Box>

      <Typography variant="subtitle2" sx={{ color: 'text.secondary', mt: 0.5 }}>
        FIELD OF VIEW
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
        <NumberField
          label="HFOV"
          unit="°"
          step={1}
          value={spec.hfov}
          min={FOV_MIN}
          max={Math.max(FOV_INPUT_MAX, spec.hfov)}
          helperText={clampNote(spec.hfov)}
          inherited={inherited && sensor.override?.hfov === undefined}
          onChange={(hfov) => setFov({ hfov })}
        />
        <NumberField
          label="VFOV"
          unit="°"
          step={1}
          value={spec.vfov}
          min={FOV_MIN}
          max={Math.max(FOV_INPUT_MAX, spec.vfov)}
          helperText={clampNote(spec.vfov)}
          inherited={inherited && sensor.override?.vfov === undefined}
          onChange={(vfov) => setFov({ vfov })}
        />
        <NumberField
          label="Range"
          unit="m"
          step={0.5}
          value={spec.range}
          min={RANGE_MIN}
          max={1000}
          inherited={inherited && sensor.override?.range === undefined}
          onChange={(range) => setFov({ range })}
        />
      </Box>

      <Divider sx={{ my: 0.5 }} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Readout
          label="Footprint area"
          value={coverage.polygon ? `${fmt(coverage.area, 1)} m²` : 'no ground contact'}
        />
        <Readout
          label="X extent"
          value={
            coverage.extentX
              ? `${fmt(coverage.extentX[0])} … ${fmt(coverage.extentX[1])} m`
              : NO_VALUE
          }
        />
        <Readout
          label="Y extent"
          value={
            coverage.extentY
              ? `${fmt(coverage.extentY[0])} … ${fmt(coverage.extentY[1])} m`
              : NO_VALUE
          }
        />
        <Readout
          label="Blind gap to body"
          value={coverage.blindGap === null ? NO_VALUE : `${fmt(coverage.blindGap)} m`}
          color={coverage.blindGap && coverage.blindGap > 0.5 ? 'warning.main' : undefined}
        />
      </Box>

      {insideBody && (
        <Alert severity="warning" sx={{ py: 0 }}>
          This sensor sits inside the vehicle box. The body will occlude it.
        </Alert>
      )}

      <Button
        color="error"
        startIcon={<DeleteOutlineIcon />}
        onClick={() => removeSensor(sensor.id)}
        sx={{ alignSelf: 'flex-start' }}
      >
        Delete sensor
      </Button>
    </Box>
  );
}
