import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import type { RangeMode } from '../core/types';
import { gridExtents } from '../scene/GroundGrid';
import { GRID_SIZE_LIMITS, useStore, type DisplayOptions } from '../store/useStore';
import DragModeControl from './DragModeControl';
import NumberField from './NumberField';
import { Panel } from './Panel';
import { CONTROL_LABEL_SX, CONTROL_LABEL_WIDTH, MONO } from '../theme';

const TOGGLES: Array<[keyof DisplayOptions, string]> = [
  ['volume', 'Shaded volume'],
  ['edges', 'Wireframe edges'],
  ['axis', 'Optical axis'],
  ['belowGround', 'FOV below ground'],
  ['mergeFovs', 'Merge overlaps'],
];

export default function DisplayPanel() {
  const display = useStore((s) => s.display);
  const setDisplay = useStore((s) => s.setDisplay);
  const rangeMode = useStore((s) => s.rangeMode);
  const setRangeMode = useStore((s) => s.setRangeMode);

  const { fineHalf, majorStep, coarseHalf } = gridExtents(display.gridSize);

  /**
   * Trailing zeros are noise on a figure nobody types: these are the grid's reach, not a
   * measurement. Dropping them also keeps the line on one row, which two decimals did not.
   */
  const trim = (v: number) => String(Math.round(v * 100) / 100);

  return (
    <Panel title="Display">
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ width: 200, flexShrink: 0 }}>
          <NumberField
            label="Cell size"
            unit="m"
            step={0.1}
            value={display.gridSize}
            min={GRID_SIZE_LIMITS[0]}
            max={GRID_SIZE_LIMITS[1]}
            disabled={!display.grid}
            onChange={(gridSize) => setDisplay({ gridSize })}
          />
        </Box>
        <FormControlLabel
          // `auto` pushes it to the right wall; `mx: 0` drops the 11 px MUI pulls labels left by.
          sx={{ mx: 0, ml: 'auto' }}
          control={
            <Switch
              size="small"
              checked={display.grid}
              onChange={(e) => setDisplay({ grid: e.target.checked })}
            />
          }
          label="Grid"
          slotProps={{ typography: { variant: 'body2', fontSize: 13 } }}
        />
      </Box>

      <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 1 }}>
        {`fine to ${trim(fineHalf)} m · heavy every ${trim(majorStep)} m · out to ${trim(coarseHalf)} m`}
      </Typography>

      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Typography variant="caption" sx={CONTROL_LABEL_SX}>
            FOV opacity
          </Typography>
          <Typography sx={{ fontFamily: MONO, fontSize: 12 }}>
            {Math.round(display.opacity * 100)}%
          </Typography>
        </Box>
        <Slider
          size="small"
          value={display.opacity}
          min={0.05}
          max={0.7}
          step={0.01}
          onChange={(_, v) => setDisplay({ opacity: v as number })}
        />
      </Box>

      <Box sx={{ mt: 2, mb: 2 }}>
        <DragModeControl />
      </Box>

      {/*
        Not a display preference: it changes the footprint, the blind gap and the coverage
        percentage, so it is stored in the layout and travels with an export.
      */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
        <Typography
          variant="caption"
          sx={{ ...CONTROL_LABEL_SX, width: CONTROL_LABEL_WIDTH, flexShrink: 0 }}
        >
          Far edge
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={rangeMode}
          onChange={(_, v: RangeMode | null) => v && setRangeMode(v)}
        >
          <ToggleButton value="radial" sx={{ px: 1.25, py: 0.25 }}>
            Radial
          </ToggleButton>
          <ToggleButton value="axis" sx={{ px: 1.25, py: 0.25 }}>
            Axial
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.5 }}>
        {rangeMode === 'radial'
          ? 'Every direction stops at the stated range: the footprint is a fan.'
          : 'Measured along the optical axis, so the corners reach past the stated range.'}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 1, mt: 2 }}>
        {TOGGLES.map(([key, label]) => (
          <FormControlLabel
            key={key}
            // Reclaim the 16 px MUI reserves to the right of every label so both
            // words fit the column and the label never wraps onto a second line.
            sx={{ mr: 0 }}
            control={
              <Checkbox
                size="small"
                // Trim the default 9 px padding so the label has room to stay on one line.
                sx={{ p: 0.5 }}
                checked={display[key] as boolean}
                // The silhouette is what the merge exists to hide, so the control that draws it
                // stands down rather than sitting there ticked and doing nothing.
                disabled={key === 'edges' && display.mergeFovs}
                onChange={(e) => setDisplay({ [key]: e.target.checked })}
              />
            }
            label={label}
            slotProps={{
              typography: {
                variant: 'body2',
                noWrap: true,
                color: key === 'edges' && display.mergeFovs ? 'text.disabled' : undefined,
              },
            }}
          />
        ))}
      </Box>

      {display.mergeFovs && (
        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 1 }}>
          Overlaps stop compounding and the coverage draws as one shape. Every sensor keeps its
          own range; only the shading merges.
        </Typography>
      )}
    </Panel>
  );
}
